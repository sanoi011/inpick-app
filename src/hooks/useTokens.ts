"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 토큰 상태 훅 — Phase 8(Supabase 스키마)이 들어가기 전 임시 로컬 구현.
 * 가입 시 5토큰 자동 증정. localStorage 영속.
 */

const STORAGE_KEY = "inpick_token_state_v1";
const SIGNUP_BONUS = 5;

interface TokenState {
  balance: number;
  totalUsed: number;
  totalPurchased: number;
  history: TokenTransaction[];
}

export interface TokenTransaction {
  id: string;
  type: "signup_bonus" | "purchase" | "use" | "refund";
  feature?: "ai_render" | "ar_session" | "drawing_option";
  amount: number; // 양수=충전, 음수=사용
  balanceAfter: number;
  at: number; // ms
}

const init: TokenState = {
  balance: SIGNUP_BONUS,
  totalUsed: 0,
  totalPurchased: 0,
  history: [
    {
      id: "init",
      type: "signup_bonus",
      amount: SIGNUP_BONUS,
      balanceAfter: SIGNUP_BONUS,
      at: Date.now(),
    },
  ],
};

function read(): TokenState {
  if (typeof window === "undefined") return init;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return init;
    return JSON.parse(raw) as TokenState;
  } catch {
    return init;
  }
}

function write(s: TokenState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useTokens() {
  const [state, setState] = useState<TokenState>(init);

  useEffect(() => {
    setState(read());
  }, []);

  const persist = useCallback((next: TokenState) => {
    setState(next);
    write(next);
  }, []);

  /** amount 만큼 차감. 잔액 부족 시 false 반환. */
  const consume = useCallback(
    async (amount: number, feature: TokenTransaction["feature"]): Promise<boolean> => {
      let ok = false;
      setState((curr) => {
        if (curr.balance < amount) {
          ok = false;
          return curr;
        }
        const next: TokenState = {
          ...curr,
          balance: curr.balance - amount,
          totalUsed: curr.totalUsed + amount,
          history: [
            {
              id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: "use",
              feature,
              amount: -amount,
              balanceAfter: curr.balance - amount,
              at: Date.now(),
            },
            ...curr.history,
          ],
        };
        write(next);
        ok = true;
        return next;
      });
      // 상태 setter는 비동기이지만, ok는 동기 capture됨
      return ok;
    },
    []
  );

  /** amount 만큼 충전. */
  const purchase = useCallback((amount: number) => {
    setState((curr) => {
      const next: TokenState = {
        ...curr,
        balance: curr.balance + amount,
        totalPurchased: curr.totalPurchased + amount,
        history: [
          {
            id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: "purchase",
            amount,
            balanceAfter: curr.balance + amount,
            at: Date.now(),
          },
          ...curr.history,
        ],
      };
      write(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => persist(init), [persist]);

  return { ...state, consume, purchase, reset };
}
