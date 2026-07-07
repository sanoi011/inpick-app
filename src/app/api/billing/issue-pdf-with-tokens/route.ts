/**
 * POST /api/billing/issue-pdf-with-tokens — 보유 토큰 차감으로 견적서 PDF 발급권 부여.
 *
 * 앱(IAP) 경로 전용 플로우 (TestFlight 피드백 2026-07-02 #6 "보유 토큰 우선 차감"):
 *   앱에서는 외부 PG(토스) 사용 불가(App Store 3.1.1) →
 *   토큰 잔액 충분 → 이 API로 차감·발급 / 부족 → 클라이언트가 토큰 IAP 충전 유도 후 재시도.
 *
 * 토큰 가격: active pricing_versions 기준
 *   tokensNeeded = ceil(pdf_single_price_krw / base_token_unit_price_krw)
 *
 * 멱등성:
 *   - 토큰 차감: consume:estimate_pdf_issue:{estimateId|projectId} — 같은 견적 재발급은 재차감 없음
 *   - 발급: 같은 ledgerId에 이미 발급된 entitlement 재사용
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  consumeTokensForAction,
  getTokenWallet,
  InsufficientBalanceError,
} from "@/lib/inpick/tokens/ledger";
import { grantEstimatePdfSingleWithTokens } from "@/lib/inpick/entitlements";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Body {
  estimateId?: string | null;
  consumerProjectId?: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Body;

  // 1) active pricing → PDF 토큰가 산출
  const { data: pricing } = await admin
    .from("pricing_versions")
    .select("pdf_single_price_krw, base_token_unit_price_krw")
    .eq("status", "active")
    .maybeSingle();
  const pdfKrw = (pricing as { pdf_single_price_krw?: number } | null)?.pdf_single_price_krw;
  const unitKrw = (pricing as { base_token_unit_price_krw?: number } | null)
    ?.base_token_unit_price_krw;
  if (!pdfKrw || !unitKrw || unitKrw <= 0) {
    return NextResponse.json({ error: "pricing_not_configured" }, { status: 503 });
  }
  const tokensNeeded = Math.max(1, Math.ceil(pdfKrw / unitKrw));

  // 2) 잔액 확인 (부족 시 402 — 클라이언트가 충전 유도)
  const wallet = await getTokenWallet(user.id);
  const balance = wallet?.balance ?? 0;
  if (balance < tokensNeeded) {
    return NextResponse.json(
      {
        error: "INSUFFICIENT_TOKENS",
        tokensNeeded,
        balance,
        hint: `PDF 발급에 ${tokensNeeded}토큰이 필요합니다 (보유 ${balance}토큰)`,
      },
      { status: 402 },
    );
  }

  // 3) 차감 → 발급
  const jobId = body.estimateId ?? body.consumerProjectId ?? crypto.randomUUID();
  try {
    const consumed = await consumeTokensForAction({
      userId: user.id,
      action: "estimate_pdf_issue",
      jobId,
      amount: tokensNeeded,
      reasonKo: `견적서 PDF 발급 (${tokensNeeded}토큰)`,
      metadata: {
        estimateId: body.estimateId ?? null,
        consumerProjectId: body.consumerProjectId ?? null,
      },
    });
    const grant = await grantEstimatePdfSingleWithTokens({
      userId: user.id,
      ledgerId: consumed.ledgerId,
      estimateId: body.estimateId ?? null,
      consumerProjectId: body.consumerProjectId ?? null,
    });
    // PDF 발급 완료 계측 (fire-and-forget)
    trackServerEventAsync({
      eventName: AnalyticsEvents.PdfIssued,
      actorType: "consumer",
      userId: user.id,
      estimateId: body.estimateId ?? undefined,
      source: "api",
      props: {
        source: "tokens",
        tokensSpent: consumed.idempotent ? 0 : tokensNeeded,
        tokensNeeded,
        idempotent: consumed.idempotent,
        consumerProjectId: body.consumerProjectId ?? undefined,
      },
    });
    return NextResponse.json({
      entitlementId: grant.entitlementId,
      tokensSpent: consumed.idempotent ? 0 : tokensNeeded,
      tokensNeeded,
      balanceAfter: consumed.balanceAfter,
      idempotent: consumed.idempotent,
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json(
        { error: "INSUFFICIENT_TOKENS", tokensNeeded, balance },
        { status: 402 },
      );
    }
    console.error("[issue-pdf-with-tokens] failed:", err);
    return NextResponse.json(
      { error: "ISSUE_FAILED", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
