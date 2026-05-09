/**
 * 토큰 정책 단일 진실원 + server-side 차감/환불 helper.
 *
 * 가이드: InPick_Pipeline_Validation_v2.md §4-1
 *
 * 핵심 원칙:
 *  - 비용 발생 endpoint는 호출 직전 enforceConsume() 통과해야 한다.
 *  - 외부 API 호출 실패 시 refundCredits()로 즉시 자동 환불.
 *  - DB 변경 0 — 기존 deduct_tokens RPC + user_credits/user_tokens 테이블 재사용.
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
  "refine-render": 1, // 자재 교체
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
 * RPC `deduct_tokens`의 feature 인자에 맞게 매핑.
 * (RPC가 ai_render | ar_session | drawing_option | welcome | manual만 받음)
 */
function mapFeatureForRpc(f: CreditFeature): string {
  if (f === "render-room" || f === "render-room-high" || f === "refine-render") {
    return "ai_render";
  }
  if (f === "normalize-floorplan") return "drawing_option";
  return "manual";
}

/**
 * server-side 토큰 차감.
 *  - 인증 확인 (게스트는 401)
 *  - cost === 0이면 인증 통과만 검사하고 즉시 반환
 *  - deduct_tokens RPC → user_credits → user_tokens 3단계 폴백 (기존 /api/user/consume 동일 패턴)
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

  // 1순위: deduct_tokens RPC (atomic)
  try {
    const { data, error } = await admin.rpc("deduct_tokens", {
      p_user_id: user.id,
      p_amount: cost,
      p_feature: mapFeatureForRpc(feature),
    });
    if (!error && data?.success) {
      const { data: tok } = await admin
        .from("user_tokens")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return {
        userId: user.id,
        balance: tok?.balance ?? 0,
        charged: cost,
        source: "rpc_deduct_tokens",
      };
    }
  } catch {
    /* fallback */
  }

  // 2순위: user_credits 직접 차감
  const { data: cred } = await admin
    .from("user_credits")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cred && cred.balance >= cost) {
    const newBal = cred.balance - cost;
    const { error } = await admin
      .from("user_credits")
      .update({ balance: newBal })
      .eq("user_id", user.id);
    if (!error) {
      await admin.from("credit_transactions").insert({
        user_id: user.id,
        amount: -cost,
        type: "USE",
        description: `토큰 사용 (${feature})${metadata && Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : ""}`,
      });
      return { userId: user.id, balance: newBal, charged: cost, source: "user_credits" };
    }
  }

  // 3순위: user_tokens 직접 차감
  const { data: tok } = await admin
    .from("user_tokens")
    .select("balance, total_used")
    .eq("user_id", user.id)
    .maybeSingle();
  if (tok && tok.balance >= cost) {
    const newBal = tok.balance - cost;
    const { error } = await admin
      .from("user_tokens")
      .update({
        balance: newBal,
        total_used: (tok.total_used ?? 0) + cost,
      })
      .eq("user_id", user.id);
    if (!error) {
      await admin.from("token_transactions").insert({
        user_id: user.id,
        type: "use",
        feature: mapFeatureForRpc(feature),
        amount: -cost,
        balance_after: newBal,
      });
      return { userId: user.id, balance: newBal, charged: cost, source: "user_tokens" };
    }
  }

  throw new CreditError("INSUFFICIENT_CREDITS", 402, {
    creditsBalance: cred?.balance ?? null,
    tokensBalance: tok?.balance ?? null,
    required: cost,
  });
}

/**
 * API 실패 시 환불.
 * 차감과 같은 우선순위로 user_tokens → user_credits 복원.
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

    // 우선 user_tokens
    const { data: tok } = await admin
      .from("user_tokens")
      .select("balance, total_used")
      .eq("user_id", userId)
      .maybeSingle();
    if (tok) {
      const newBal = tok.balance + amount;
      await admin
        .from("user_tokens")
        .update({
          balance: newBal,
          total_used: Math.max(0, (tok.total_used ?? 0) - amount),
        })
        .eq("user_id", userId);
      await admin.from("token_transactions").insert({
        user_id: userId,
        type: "refund",
        amount,
        balance_after: newBal,
      });
      return { refunded: true, source: "user_tokens" };
    }

    // user_credits 폴백
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
