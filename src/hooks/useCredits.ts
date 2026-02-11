"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CREDITS_PER_GENERATION, FREE_GENERATION_LIMIT } from "@/types/credits";
import type { UserCredits } from "@/types/credits";

export function useCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // 크레딧 로드
  const loadCredits = useCallback(async () => {
    if (!user) {
      setCredits(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // 레코드 없음 - 새로 생성
        const { data: newData } = await supabase
          .from("user_credits")
          .insert({ user_id: user.id, balance: 0, free_generations_used: 0 })
          .select()
          .single();

        if (newData) {
          setCredits({
            id: newData.id,
            userId: newData.user_id,
            balance: newData.balance,
            freeGenerationsUsed: newData.free_generations_used,
            createdAt: newData.created_at,
            updatedAt: newData.updated_at,
          });
        }
      } else if (data) {
        setCredits({
          id: data.id,
          userId: data.user_id,
          balance: data.balance,
          freeGenerationsUsed: data.free_generations_used,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch {
      // Supabase 테이블 미생성 시 localStorage 폴백
      const stored = localStorage.getItem(`inpick_credits_${user.id}`);
      if (stored) {
        setCredits(JSON.parse(stored));
      } else {
        const fallback: UserCredits = {
          id: crypto.randomUUID(),
          userId: user.id,
          balance: 0,
          freeGenerationsUsed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(fallback));
        setCredits(fallback);
      }
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // 이미지 생성 가능 여부
  const canGenerate = useCallback((): boolean => {
    if (!credits) return false;
    // 무료 횟수 남음
    if (credits.freeGenerationsUsed < FREE_GENERATION_LIMIT) return true;
    // 크레딧 충분
    if (credits.balance >= CREDITS_PER_GENERATION) return true;
    return false;
  }, [credits]);

  // 크레딧 사용 (이미지 생성 시)
  const spendCredits = useCallback(async (): Promise<boolean> => {
    if (!credits || !user) return false;

    const isFree = credits.freeGenerationsUsed < FREE_GENERATION_LIMIT;

    if (!isFree && credits.balance < CREDITS_PER_GENERATION) {
      return false;
    }

    try {
      if (isFree) {
        // 무료 사용
        const updated = {
          ...credits,
          freeGenerationsUsed: credits.freeGenerationsUsed + 1,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from("user_credits")
          .update({ free_generations_used: updated.freeGenerationsUsed })
          .eq("user_id", user.id);

        setCredits(updated);
        localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(updated));
      } else {
        // 크레딧 차감
        const updated = {
          ...credits,
          balance: credits.balance - CREDITS_PER_GENERATION,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from("user_credits")
          .update({ balance: updated.balance })
          .eq("user_id", user.id);

        // 트랜잭션 기록
        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: -CREDITS_PER_GENERATION,
          type: "USE",
          description: "AI 이미지 생성",
        });

        setCredits(updated);
        localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(updated));
      }
      return true;
    } catch {
      // DB 실패 시 localStorage 폴백
      const updated = isFree
        ? { ...credits, freeGenerationsUsed: credits.freeGenerationsUsed + 1 }
        : { ...credits, balance: credits.balance - CREDITS_PER_GENERATION };
      updated.updatedAt = new Date().toISOString();
      localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(updated));
      setCredits(updated);
      return true;
    }
  }, [credits, user, supabase]);

  // 크레딧 충전
  const chargeCredits = useCallback(async (amount: number): Promise<boolean> => {
    if (!credits || !user) return false;

    try {
      const updated = {
        ...credits,
        balance: credits.balance + amount,
        updatedAt: new Date().toISOString(),
      };

      await supabase
        .from("user_credits")
        .update({ balance: updated.balance })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount,
        type: "CHARGE",
        description: `${amount} 크레딧 충전`,
      });

      setCredits(updated);
      localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(updated));
      return true;
    } catch {
      const updated = { ...credits, balance: credits.balance + amount, updatedAt: new Date().toISOString() };
      localStorage.setItem(`inpick_credits_${user.id}`, JSON.stringify(updated));
      setCredits(updated);
      return true;
    }
  }, [credits, user, supabase]);

  return {
    credits,
    loading,
    canGenerate,
    spendCredits,
    chargeCredits,
    reload: loadCredits,
  };
}
