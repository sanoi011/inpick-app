"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 전역 Token + Auth 상태 Provider.
 * - app/layout.tsx에서 한 번만 mount → 모든 페이지가 동일 상태 공유
 * - Supabase singleton client + 단일 onAuthStateChange listener
 * - 페이지 navigation에도 세션 안정적 유지
 */

const FALLBACK_KEY = "inpick_token_state_v2";
const SIGNUP_BONUS = 5;

export interface TokenTransaction {
  id: string;
  type: "signup_bonus" | "purchase" | "use" | "refund" | "admin_adjust";
  feature?:
    | "ai_render"
    | "image_unlock"
    | "estimate_details"
    | "ar_session"
    | "drawing_option"
    | "welcome"
    | "manual";
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
  userId: string | null;
}

interface TokensContextValue extends TokenState {
  consume: (
    amount: number,
    feature: NonNullable<TokenTransaction["feature"]>,
  ) => Promise<boolean>;
  purchase: (
    amount: number,
    paymentId: string,
    metadata?: Record<string, unknown>,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const initial: TokenState = {
  balance: SIGNUP_BONUS,
  totalUsed: 0,
  totalPurchased: 0,
  history: [],
  loading: true,
  authenticated: false,
  userId: null,
};

function readFallback(): Pick<
  TokenState,
  "balance" | "totalUsed" | "totalPurchased" | "history"
> {
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

function writeFallback(
  s: Pick<TokenState, "balance" | "totalUsed" | "totalPurchased" | "history">,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(s));
}

const TokensContext = createContext<TokensContextValue | null>(null);

export function TokensProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TokenState>(initial);
  const supabase = useMemo(() => createClient(), []);

  const loadFromSupabase = useCallback(
    async (userId: string) => {
      // server route 통해 service_role로 RLS 우회 (client는 user_credits 직접 read 불가)
      try {
        const res = await fetch("/api/user/balance", { cache: "no-store" });
        const d = await res.json();
        setState({
          balance: d.balance ?? SIGNUP_BONUS,
          totalUsed: d.totalUsed ?? 0,
          totalPurchased: d.totalPurchased ?? 0,
          history: [],
          loading: false,
          authenticated: !!d.authenticated,
          userId: d.userId ?? userId,
        });
        return;
      } catch (e) {
        console.warn("[tokens] /api/user/balance 실패, client 직접 조회 fallback:", e);
      }
      // 폴백: client 직접 조회 (RLS 통과되는 케이스) — user_credits 단일 소스
      // (user_tokens는 운영 DB에 없는 죽은 테이블이라 2026-07-07 조회 제거)
      const { data: cred } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      setState({
        balance: cred?.balance ?? SIGNUP_BONUS,
        totalUsed: 0,
        totalPurchased: 0,
        history: [],
        loading: false,
        authenticated: true,
        userId,
      });
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await loadFromSupabase(user.id);
    } else {
      const f = readFallback();
      setState({ ...f, loading: false, authenticated: false, userId: null });
    }
  }, [supabase, loadFromSupabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        await loadFromSupabase(user.id);
      } else {
        const f = readFallback();
        setState({ ...f, loading: false, authenticated: false, userId: null });
      }
    })();

    // 단일 listener — Provider 마운트 동안 영구 유지
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        const f = readFallback();
        setState({ ...f, loading: false, authenticated: false, userId: null });
        return;
      }
      if (session?.user) {
        await loadFromSupabase(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadFromSupabase]);

  const consume = useCallback(
    async (
      amount: number,
      feature: NonNullable<TokenTransaction["feature"]>,
    ): Promise<boolean> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // 로그인 사용자는 서버 차감이 유일한 정본 — 실패 시 로컬 옵티미스틱으로 넘어가면
        // 서버 차감 없이 기능이 실행되는 무료 사용 구멍이 됨(2026-07-05 H8). 항상 여기서 반환.
        try {
          const res = await fetch("/api/user/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, feature }),
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.success) {
            await loadFromSupabase(user.id);
            return true;
          }
          if (res.status === 402) {
            console.warn("[tokens] 잔액 부족:", d);
          } else {
            console.warn("[tokens] /api/user/consume 실패:", res.status, d);
          }
          return false;
        } catch (e) {
          console.warn("[tokens] /api/user/consume throw:", e);
          return false; // 네트워크 오류 시에도 차감 없이 통과시키지 않음
        }
      }
      // 비로그인(익명)만 로컬 폴백 — 서버 잔액이 없으므로 로컬 보너스로 동작
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
    [supabase, loadFromSupabase],
  );

  const purchase = useCallback(
    async (
      amount: number,
      paymentId: string,
      metadata?: Record<string, unknown>,
    ): Promise<boolean> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    [supabase, loadFromSupabase],
  );

  const value: TokensContextValue = {
    ...state,
    consume,
    purchase,
    refresh,
  };

  return <TokensContext.Provider value={value}>{children}</TokensContext.Provider>;
}

/**
 * 전역 토큰 상태 hook — 반드시 TokensProvider 하위에서 사용
 */
export function useTokens(): TokensContextValue {
  const ctx = useContext(TokensContext);
  if (!ctx) {
    // Provider 없는 환경 (테스트 등)에서 안전 fallback
    return {
      ...initial,
      consume: async () => false,
      purchase: async () => false,
      refresh: async () => {},
    };
  }
  return ctx;
}
