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
      // user_tokens (신규) + user_credits (구) 양쪽 모두 조회 → 큰 잔액 사용
      const [tokRes, credRes, txRes] = await Promise.all([
        supabase
          .from("user_tokens")
          .select("balance, total_purchased, total_used")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("token_transactions")
          .select("id, type, feature, amount, balance_after, payment_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const tokBalance = tokRes.data?.balance ?? null;
      const credBalance = credRes.data?.balance ?? null;
      // 둘 중 큰 값 사용 (옛 user_credits에 누적된 잔액 보존)
      const effectiveBalance =
        tokBalance != null && credBalance != null
          ? Math.max(tokBalance, credBalance)
          : (tokBalance ?? credBalance ?? SIGNUP_BONUS);

      setState({
        balance: effectiveBalance,
        totalUsed: tokRes.data?.total_used ?? 0,
        totalPurchased: tokRes.data?.total_purchased ?? 0,
        history: (txRes.data as TokenTransaction[]) ?? [],
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
        // 1) RPC deduct_tokens 시도
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
          console.warn("[tokens] RPC deduct_tokens 실패:", error);
        } catch (e) {
          console.warn("[tokens] RPC throw:", e);
        }
        // 2) user_credits 직접 차감 (옛 시스템 호환)
        try {
          const { data: cur } = await supabase
            .from("user_credits")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle();
          const curBal = cur?.balance ?? 0;
          if (curBal >= amount) {
            await supabase
              .from("user_credits")
              .update({ balance: curBal - amount })
              .eq("user_id", user.id);
            await supabase.from("credit_transactions").insert({
              user_id: user.id,
              amount: -amount,
              type: "USE",
              description: `토큰 사용 (${feature})`,
            });
            await loadFromSupabase(user.id);
            return true;
          }
        } catch (e) {
          console.warn("[tokens] user_credits 차감 실패:", e);
        }
      }
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
