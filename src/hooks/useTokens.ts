"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 토큰 상태 훅 — Supabase user_tokens 기반.
 * 로그인 안 된 경우 localStorage 폴백 (가입 시 5토큰 자동 시뮬레이션).
 */

const FALLBACK_KEY = "inpick_token_state_v2";
const SIGNUP_BONUS = 5;

export interface TokenTransaction {
  id: string;
  type: "signup_bonus" | "purchase" | "use" | "refund" | "admin_adjust";
  feature?: "ai_render" | "ar_session" | "drawing_option" | "welcome" | "manual";
  amount: number;
  balance_after: number;
  payment_id?: string | null;
  created_at: string;
}

interface TokenState {
  balance: number;
  totalUsed: number;
  totalPurchased: number;
  history: TokenTransaction[];
  loading: boolean;
  authenticated: boolean;
}

const initial: TokenState = {
  balance: SIGNUP_BONUS,
  totalUsed: 0,
  totalPurchased: 0,
  history: [],
  loading: true,
  authenticated: false,
};

function readFallback(): Pick<TokenState, "balance" | "totalUsed" | "totalPurchased" | "history"> {
  if (typeof window === "undefined") {
    return { balance: SIGNUP_BONUS, totalUsed: 0, totalPurchased: 0, history: [] };
  }
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) {
      const init = {
        balance: SIGNUP_BONUS,
        totalUsed: 0,
        totalPurchased: 0,
        history: [
          {
            id: "init",
            type: "signup_bonus" as const,
            feature: "welcome" as const,
            amount: SIGNUP_BONUS,
            balance_after: SIGNUP_BONUS,
            created_at: new Date().toISOString(),
          },
        ],
      };
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(init));
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return { balance: SIGNUP_BONUS, totalUsed: 0, totalPurchased: 0, history: [] };
  }
}

function writeFallback(s: Pick<TokenState, "balance" | "totalUsed" | "totalPurchased" | "history">) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(s));
}

export function useTokens() {
  const [state, setState] = useState<TokenState>(initial);
  const supabase = createClient();

  const loadFromSupabase = useCallback(async (userId: string) => {
    const { data: tok } = await supabase
      .from("user_tokens")
      .select("balance, total_purchased, total_used")
      .eq("user_id", userId)
      .single();
    const { data: txs } = await supabase
      .from("token_transactions")
      .select("id, type, feature, amount, balance_after, payment_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setState({
      balance: tok?.balance ?? SIGNUP_BONUS,
      totalUsed: tok?.total_used ?? 0,
      totalPurchased: tok?.total_purchased ?? 0,
      history: (txs as TokenTransaction[]) ?? [],
      loading: false,
      authenticated: true,
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        await loadFromSupabase(user.id);
      } else {
        const f = readFallback();
        setState({ ...f, loading: false, authenticated: false });
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await loadFromSupabase(session.user.id);
      else {
        const f = readFallback();
        setState({ ...f, loading: false, authenticated: false });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadFromSupabase]);

  /** 차감 — 인증 시 RPC, RPC 실패 또는 비인증 시 client state fallback */
  const consume = useCallback(
    async (
      amount: number,
      feature: NonNullable<TokenTransaction["feature"]>
    ): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data, error } = await supabase.rpc("deduct_tokens", {
            p_user_id: user.id,
            p_amount: amount,
            p_feature: feature,
          });
          if (!error && data?.success) {
            await loadFromSupabase(user.id);
            return true;
          }
          // RPC 실패 시 client state로 폴백 (RPC 미배포 / 권한 등 일시적 이슈 대응)
          console.warn("[tokens] RPC deduct_tokens 실패, client fallback 사용:", error);
        } catch (e) {
          console.warn("[tokens] RPC throw, client fallback:", e);
        }
      }
      // client state fallback (인증/비인증 공통 — 잔액 충분하면 즉시 차감)
      let ok = false;
      setState((curr) => {
        if (curr.balance < amount) {
          ok = false;
          return curr;
        }
        const tx: TokenTransaction = {
          id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: "use",
          feature,
          amount: -amount,
          balance_after: curr.balance - amount,
          created_at: new Date().toISOString(),
        };
        const next = {
          ...curr,
          balance: curr.balance - amount,
          totalUsed: curr.totalUsed + amount,
          history: [tx, ...curr.history],
        };
        if (!user) {
          writeFallback({
            balance: next.balance,
            totalUsed: next.totalUsed,
            totalPurchased: next.totalPurchased,
            history: next.history,
          });
        }
        ok = true;
        return next;
      });
      return ok;
    },
    [supabase, loadFromSupabase]
  );

  /** 충전 — 결제 성공 후 호출 (PG paymentKey 전달) */
  const purchase = useCallback(
    async (amount: number, paymentId: string, metadata?: Record<string, unknown>): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.rpc("purchase_tokens", {
          p_user_id: user.id,
          p_amount: amount,
          p_payment_id: paymentId,
          p_metadata: metadata ?? {},
        });
        if (error || !data?.success) return false;
        await loadFromSupabase(user.id);
        return true;
      }
      // fallback
      setState((curr) => {
        const tx: TokenTransaction = {
          id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: "purchase",
          feature: "manual",
          amount,
          balance_after: curr.balance + amount,
          payment_id: paymentId,
          created_at: new Date().toISOString(),
        };
        const next = {
          ...curr,
          balance: curr.balance + amount,
          totalPurchased: curr.totalPurchased + amount,
          history: [tx, ...curr.history],
        };
        writeFallback({
          balance: next.balance,
          totalUsed: next.totalUsed,
          totalPurchased: next.totalPurchased,
          history: next.history,
        });
        return next;
      });
      return true;
    },
    [supabase, loadFromSupabase]
  );

  return { ...state, consume, purchase };
}
