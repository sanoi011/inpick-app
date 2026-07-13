/**
 * 토큰 정책 단일 진실원 + server-side 차감/환불 helper.
 *
 * 가이드: InPick_Pipeline_Validation_v2.md §4-1
 *
 * 핵심 원칙:
 *  - 비용 발생 endpoint는 호출 직전 enforceConsume() 통과해야 한다.
 *  - 외부 API 호출 실패 시 refundCredits()로 즉시 자동 환불.
 *  - 원장은 user_credits + credit_transactions 단일 경로 (2026-07-07 정리 —
 *    deduct_tokens RPC/user_tokens/token_transactions는 운영 DB에 없는 죽은 경로였음).
 */
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 작업별 토큰 비용 매트릭스.
 * 변경 시 모든 endpoint가 동일 정책 사용 (단일 진실원).
 */
export const CREDIT_COSTS = {
  "render-room": 1, // 1차 미리보기 (low/medium quality)
  "render-room-high": 2, // 고화질 재생성
  "refine-render": 2, // 정밀 영역 선택 후 GPT Image 2 자재 재렌더
  "normalize-floorplan": 1, // 캐시 miss 시 (정형화)
  "extract-material": 0, // 자동 분석 무료
  "design-chat": 0, // 채팅 무료 (rate limit으로 보호)
  "sam-click": 0,
  "sam-warmup": 0,
} as const;

export type CreditFeature = keyof typeof CREDIT_COSTS;

export class CreditError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "INSUFFICIENT_CREDITS" | "DAILY_LIMIT" | "INTERNAL",
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/**
 * server-side 토큰 차감.
 *  - 인증 확인 (게스트는 401)
 *  - cost === 0이면 인증 통과만 검사하고 즉시 반환
 *  - user_credits 낙관적 동시성 차감 (읽은 잔액 일치 조건부 UPDATE, race 시 재시도)
 *
 * @throws CreditError UNAUTHENTICATED(401) / INSUFFICIENT_CREDITS(402) / INTERNAL(500)
 */
export async function enforceConsume(
  feature: CreditFeature,
  metadata: Record<string, unknown> = {},
): Promise<{ userId: string; balance: number; charged: number; source: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new CreditError("UNAUTHENTICATED", 401);
  }

  const cost = CREDIT_COSTS[feature];
  if (cost === 0) {
    return { userId: user.id, balance: -1, charged: 0, source: "free" };
  }

  const admin = createAdminClient();

  let lastBalance: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: cred } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    lastBalance = cred?.balance ?? null;
    if (!cred || cred.balance < cost) break;

    const newBal = cred.balance - cost;
    const { data: updated, error } = await admin
      .from("user_credits")
      .update({ balance: newBal })
      .eq("user_id", user.id)
      .eq("balance", cred.balance)
      .select("balance");
    if (error) break;
    if (!updated || updated.length === 0) continue; // 동시 요청 race — 재시도

    await admin.from("credit_transactions").insert({
      user_id: user.id,
      amount: -cost,
      type: "USE",
      description: `토큰 사용 (${feature})${metadata && Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : ""}`,
    });
    return { userId: user.id, balance: newBal, charged: cost, source: "user_credits" };
  }

  throw new CreditError("INSUFFICIENT_CREDITS", 402, {
    creditsBalance: lastBalance,
    required: cost,
  });
}

/**
 * API 실패 시 환불 — 차감 원장과 동일하게 user_credits 복원.
 * 실패해도 throw하지 않음 — 호출자가 외부 API 에러를 우선 보고할 수 있게.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<{ refunded: boolean; source?: string }> {
  if (amount <= 0) return { refunded: false };
  try {
    const admin = createAdminClient();
    const { data: cred } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (cred) {
      const newBal = cred.balance + amount;
      await admin.from("user_credits").update({ balance: newBal }).eq("user_id", userId);
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount,
        type: "REFUND",
        description: reason,
      });
      return { refunded: true, source: "user_credits" };
    }
    return { refunded: false };
  } catch (e) {
    console.warn("[credit-policy] refund failed:", e);
    return { refunded: false };
  }
}
