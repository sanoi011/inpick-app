/**
 * POST /api/payments/checkout
 *
 * Toss Payment Widget 호출 직전, payment_intents 생성 + orderId 발급.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2
 *
 * 핵심:
 *  - 로그인 + consumer_profiles 존재 필수
 *  - phone_verified=true 필수 (출시 v0 정책)
 *  - productCode → payment_products에서 amount 조회 (클라이언트 amount 무시)
 *  - orderId 서버 생성 (UNIQUE)
 *  - Toss 키 없으면 mock 모드 (직접 크레딧 충전 — 개발/테스트용)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { creditTokensAfterPayment } from "@/lib/inpick/tokens/ledger";
import { grantEstimatePdfSingleAfterPayment } from "@/lib/inpick/entitlements";

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

interface CheckoutBody {
  productCode?: string;
  // legacy 호환
  packageId?: string;
  projectId?: string;
  returnPath?: string;
  // PDF 단발 결제 시 scope (estimateId 또는 consumerProjectId)
  estimateId?: string;
  consumerProjectId?: string;
}

// legacy packageId → 새 productCode 매핑 (호환)
// v2 (2026-05-14): CREDIT_PACKAGES.id가 이미 productCode와 동일하므로 legacy만 유지
const LEGACY_PACKAGE_MAP: Record<string, string> = {
  "pkg-10": "ai_credit_10",
  "pkg-30": "ai_credit_30",
  "pkg-50": "ai_credit_30",
  "pkg-100": "ai_credit_100",
  "pkg-300": "ai_credit_300",
  // v2 신규 id는 그대로 productCode로 사용 가능 (자동 매핑)
  ai_credit_10: "ai_credit_10",
  ai_credit_30: "ai_credit_30",
  ai_credit_100: "ai_credit_100",
  ai_credit_300: "ai_credit_300",
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutBody;
  const productCode =
    body.productCode || (body.packageId ? LEGACY_PACKAGE_MAP[body.packageId] : undefined);
  if (!productCode) {
    return NextResponse.json(
      { error: "missing_product_code", hint: "productCode 필수" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }

  // 1) consumer_profiles 존재 + phone_verified 검증
  const { data: profile } = await admin
    .from("consumer_profiles")
    .select("id, phone_verified, name, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      {
        error: "profile_required",
        hint: "회원가입 절차를 완료해주세요.",
      },
      { status: 403 },
    );
  }
  // 출시 v0: phone_verified 정책 — Phase 1 (SMS provider 가입 전)에는 임시로 phone 존재만 검증
  const requirePhoneVerified = process.env.REQUIRE_PHONE_VERIFIED === "true";
  if (requirePhoneVerified && !(profile as { phone_verified: boolean }).phone_verified) {
    return NextResponse.json(
      {
        error: "phone_verification_required",
        hint: "휴대폰 인증이 필요합니다. /mypage/account에서 인증을 완료해주세요.",
      },
      { status: 403 },
    );
  }

  // 2) product 조회 (서버 amount 기준) — is_visible + effective 기간도 검증
  const nowIso = new Date().toISOString();
  const { data: product, error: pErr } = await admin
    .from("payment_products")
    .select("*")
    .eq("code", productCode)
    .eq("is_active", true)
    .or(`is_visible.is.null,is_visible.eq.true`)
    .or(`effective_from.is.null,effective_from.lte.${nowIso}`)
    .or(`effective_to.is.null,effective_to.gte.${nowIso}`)
    .maybeSingle();
  if (pErr || !product) {
    return NextResponse.json(
      { error: "product_not_found", hint: `productCode=${productCode} 비활성 또는 없음` },
      { status: 404 },
    );
  }
  const prod = product as {
    id: string;
    code: string;
    product_type: string;
    name_ko: string;
    description_ko?: string;
    amount_krw: number;
    credit_amount: number;
    bonus_credit_amount: number;
    pricing_version_id?: string | null;
  };

  // 2-1) active pricing version (snapshot에 같이 박아 finalize/감사용)
  const { data: activeVer } = await admin
    .from("pricing_versions")
    .select("id, version_name, base_token_unit_price_krw, image_generation_token_cost, pdf_single_price_krw")
    .eq("status", "active")
    .maybeSingle();

  // 3) orderId 생성 (UUID 기반, UNIQUE 보장)
  const orderId = `INPICK_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://interiorpick.co.kr";
  const successUrl = `${origin}/payments/success?orderId=${orderId}`;
  const failUrl = `${origin}/payments/fail?orderId=${orderId}`;

  // 4) payment_intents INSERT — product_snapshot/pricing_version_id 고정
  //    finalize는 이 snapshot 기준 지급 — 가격 변경이 과거 결제에 영향 X
  const productSnapshot = {
    productId: prod.code,
    productDbId: prod.id,
    productType: prod.product_type,
    displayName: prod.name_ko,
    description: prod.description_ko ?? null,
    amountKrw: prod.amount_krw,
    currency: "KRW",
    tokenAmount: prod.credit_amount ?? null,
    bonusTokenAmount: prod.bonus_credit_amount ?? null,
    totalTokenAmount: (prod.credit_amount ?? 0) + (prod.bonus_credit_amount ?? 0),
    pricingVersionId: activeVer?.id ?? prod.pricing_version_id ?? null,
    pricingVersionName: activeVer?.version_name ?? null,
    baseTokenUnitPriceKrw: activeVer?.base_token_unit_price_krw ?? null,
    capturedAt: nowIso,
  };

  const { data: intent, error: intentErr } = await admin
    .from("payment_intents")
    .insert({
      user_id: user.id,
      project_id: body.projectId || null,
      product_id: prod.id,
      order_id: orderId,
      order_name: `INPICK ${prod.name_ko}`,
      product_type: prod.product_type,
      amount_krw: prod.amount_krw,
      status: "created",
      provider: "toss",
      customer_key: user.id,
      success_url: successUrl,
      fail_url: failUrl,
      // snapshot 컬럼들 (20260519 migration)
      pricing_version_id: activeVer?.id ?? null,
      product_snapshot: productSnapshot,
      token_amount: prod.credit_amount ?? null,
      bonus_token_amount: prod.bonus_credit_amount ?? null,
      metadata: {
        productCode: prod.code,
        returnPath: body.returnPath,
        estimateId: body.estimateId,
        consumerProjectId: body.consumerProjectId,
      },
    })
    .select("id, order_id")
    .single();
  if (intentErr || !intent) {
    console.error("[checkout] intent insert fail:", intentErr?.message);
    return NextResponse.json(
      { error: "intent_create_failed", hint: intentErr?.message },
      { status: 500 },
    );
  }

  const intentId = (intent as { id: string }).id;

  // 5) Mock 모드 — 개발 환경 + 명시적 플래그에서만. (production 자동 무료지급 차단)
  //    이전에는 Toss 키가 없으면 자동 mock 충전이었으나, 키 미설정 상태로 프로덕션 배포 시
  //    실결제 없이 토큰이 지급되는 구멍이 있었다. 이제 NODE_ENV!=production && ALLOW_MOCK_PAYMENT=true 필요.
  const mockAllowed =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_PAYMENT === "true";
  if (mockAllowed) {
    await admin
      .from("payment_intents")
      .update({ status: "paid" })
      .eq("id", (intent as { id: string }).id);

    // mock payment row
    const mockPaymentKey = `mock_${orderId}`;
    const { data: mockPayment } = await admin
      .from("payments")
      .insert({
        payment_intent_id: (intent as { id: string }).id,
        user_id: user.id,
        provider: "toss",
        payment_key: mockPaymentKey,
        order_id: orderId,
        method: "mock",
        amount_krw: prod.amount_krw,
        status: "DONE",
        approved_at: new Date().toISOString(),
        raw_payment: { mock: true },
      })
      .select("id")
      .single();

    // 크레딧 충전 또는 entitlement 부여
    if (mockPayment) {
      try {
        // PDF 단발 결제는 entitlement 발급
        if (prod.product_type === "pdf_estimate_single") {
          const grant = await grantEstimatePdfSingleAfterPayment({
            userId: user.id,
            paymentId: (mockPayment as { id: string }).id,
            estimateId: body.estimateId ?? null,
            consumerProjectId: body.consumerProjectId ?? null,
          });
          return NextResponse.json({
            mockMode: true,
            orderId,
            paymentIntentId: (intent as { id: string }).id,
            entitlementId: grant.entitlementId,
            productType: "pdf_estimate_single",
          });
        }

        // 기본: AI 크레딧 충전
        const credit = await creditTokensAfterPayment({
          userId: user.id,
          paymentId: (mockPayment as { id: string }).id,
          productCode: prod.code,
          paidCredits: prod.credit_amount,
          bonusCredits: prod.bonus_credit_amount,
          reasonKo: `${prod.name_ko} 구매 (Mock)`,
        });
        return NextResponse.json({
          mockMode: true,
          orderId,
          paymentIntentId: (intent as { id: string }).id,
          balanceAfter: credit.balanceAfter,
          creditsAdded: prod.credit_amount + prod.bonus_credit_amount,
        });
      } catch (err) {
        console.error("[checkout] mock credit fail:", err);
        return NextResponse.json(
          { error: "mock_credit_failed", hint: err instanceof Error ? err.message : "unknown" },
          { status: 500 },
        );
      }
    }
  }

  // 6) Toss 위젯 — Toss 키가 설정돼 있을 때만 결제 진행
  const clientKey = process.env.TOSS_PAYMENTS_CLIENT_KEY;
  if (clientKey && clientKey.length >= 20) {
    return NextResponse.json({
      mockMode: false,
      provider: "toss",
      paymentIntentId: intentId,
      orderId,
      orderName: `INPICK ${prod.name_ko}`,
      amount: prod.amount_krw,
      customerKey: user.id,
      customerName: (profile as { name: string }).name,
      successUrl,
      failUrl,
      clientKey,
    });
  }

  // 7) 활성 결제수단 없음 — intent는 created로 남겨두고 명확히 안내.
  //    (Toss 입점 심사 대기 중 상태. 무료지급은 5)의 mockAllowed 게이팅으로 차단됨)
  return NextResponse.json(
    {
      error: "no_active_payment_provider",
      hint: "현재 결제수단 준비 중입니다(토스페이먼츠 심사 대기). 곧 이용하실 수 있습니다.",
      paymentIntentId: intentId,
      orderId,
    },
    { status: 503 },
  );
}
