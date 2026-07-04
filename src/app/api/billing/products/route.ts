/**
 * GET /api/billing/products
 *
 * 사용자 + Step2 TokenPurchaseDrawer 공통 사용 — 결제창에 표시할 상품 목록.
 * - active pricing version 정보 (기준 토큰 단가, 이미지 소모, 회원가입 보너스, PDF 가격)
 * - is_visible + is_active + effective 기간 안의 상품
 * - active consumption rules
 *
 * 인증 불필요 (공개) — 단 결제는 별도 인증 필요.
 *
 * 캐시: no-store (가격 변경 즉시 반영)
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

export async function GET() {
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const nowIso = new Date().toISOString();

  // 1) active pricing version
  const { data: activeVer } = await admin
    .from("pricing_versions")
    .select("id, version_name, base_token_unit_price_krw, signup_bonus_tokens, image_generation_token_cost, pdf_single_price_krw")
    .eq("status", "active")
    .maybeSingle();

  // 2) visible + active + effective 상품
  const { data: products, error: prodErr } = await admin
    .from("payment_products")
    .select("code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, is_popular, is_visible, sort_order, effective_from, effective_to, app_store_product_id, google_play_product_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (prodErr) {
    return NextResponse.json({ error: "products_query_failed", hint: prodErr.message }, { status: 500 });
  }

  type ProductRow = {
    code: string;
    product_type: string;
    name_ko: string;
    description_ko?: string | null;
    amount_krw: number;
    credit_amount: number | null;
    bonus_credit_amount: number | null;
    is_popular?: boolean;
    is_visible?: boolean;
    sort_order?: number;
    effective_from?: string | null;
    effective_to?: string | null;
    app_store_product_id?: string | null;
    google_play_product_id?: string | null;
  };

  const visibleProducts = ((products ?? []) as ProductRow[]).filter((p) => {
    if (p.is_visible === false) return false;
    if (p.effective_from && p.effective_from > nowIso) return false;
    if (p.effective_to && p.effective_to < nowIso) return false;
    return true;
  });

  const mapped = visibleProducts.map((p) => {
    const total = (p.credit_amount ?? 0) + (p.bonus_credit_amount ?? 0);
    return {
      productId: p.code,
      productType: p.product_type as "token_pack" | "ai_credit_pack" | "pdf_estimate_single" | "subscription" | "pdf_entitlement",
      displayName: p.name_ko,
      description: p.description_ko ?? null,
      amountKrw: p.amount_krw,
      currency: "KRW" as const,
      tokenAmount: p.credit_amount ?? null,
      bonusTokenAmount: p.bonus_credit_amount ?? null,
      totalTokenAmount: total > 0 ? total : null,
      effectiveUnitPriceKrw: total > 0 ? Math.round(p.amount_krw / total) : null,
      isPopular: !!p.is_popular,
      // 네이티브 앱 IAP 매핑 (App Store / Google Play consumable product id)
      appStoreProductId: p.app_store_product_id ?? null,
      googlePlayProductId: p.google_play_product_id ?? null,
    };
  });

  // 3) active consumption rules
  const { data: rules } = await admin
    .from("token_consumption_rules")
    .select("rule_key, display_name, token_cost, is_active")
    .eq("is_active", true)
    .order("rule_key", { ascending: true });

  // 4) provider mode
  const clientKey = process.env.TOSS_PAYMENTS_CLIENT_KEY ?? "";
  let providerMode: "toss_live" | "toss_test" | "mock" = "mock";
  if (clientKey.startsWith("live_")) providerMode = "toss_live";
  else if (clientKey.startsWith("test_")) providerMode = "toss_test";

  return NextResponse.json(
    {
      pricing: activeVer
        ? {
            pricingVersionId: activeVer.id,
            pricingVersionName: activeVer.version_name,
            baseTokenUnitPriceKrw: activeVer.base_token_unit_price_krw,
            imageGenerationTokenCost: activeVer.image_generation_token_cost,
            signupBonusTokens: activeVer.signup_bonus_tokens,
            pdfSinglePriceKrw: activeVer.pdf_single_price_krw,
            // 앱 IAP 경로 — PDF 발급 토큰가 (issue-pdf-with-tokens와 동일 산식)
            pdfTokenCost:
              activeVer.pdf_single_price_krw && activeVer.base_token_unit_price_krw > 0
                ? Math.max(
                    1,
                    Math.ceil(
                      activeVer.pdf_single_price_krw / activeVer.base_token_unit_price_krw,
                    ),
                  )
                : null,
          }
        : null,
      products: mapped,
      consumptionRules: (rules ?? []).map((r) => ({
        ruleKey: r.rule_key,
        displayName: r.display_name,
        tokenCost: r.token_cost,
        isActive: r.is_active,
      })),
      providerMode,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
