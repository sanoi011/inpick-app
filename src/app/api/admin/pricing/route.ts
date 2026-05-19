/**
 * GET /api/admin/pricing
 *
 * 관리자 가격 설정 페이지의 메인 조회.
 * - active pricing version
 * - 모든 payment_products (visible/active 무관 — 관리자는 다 봄)
 * - active consumption rules + 비활성도 같이
 * - 최근 audit logs 50건
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized as checkAdmin, getAdminIdFromRequest } from "@/lib/admin-auth";

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

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const [activeVerRes, productsRes, rulesRes, logsRes, allVersionsRes] = await Promise.all([
    admin.from("pricing_versions").select("*").eq("status", "active").maybeSingle(),
    admin.from("payment_products").select("*").order("sort_order", { ascending: true }),
    admin.from("token_consumption_rules").select("*").order("rule_key", { ascending: true }),
    admin.from("pricing_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("pricing_versions").select("id, version_name, status, effective_from, published_at, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  type ProductRow = {
    id: string;
    code: string;
    product_type: string;
    name_ko: string;
    description_ko: string | null;
    amount_krw: number;
    credit_amount: number;
    bonus_credit_amount: number;
    is_active: boolean;
    is_visible: boolean | null;
    is_popular: boolean | null;
    sort_order: number;
    pricing_version_id: string | null;
    admin_note: string | null;
    effective_from: string | null;
    effective_to: string | null;
    created_at: string;
    updated_at: string;
  };

  const mappedProducts = ((productsRes.data ?? []) as ProductRow[]).map((p) => {
    const total = (p.credit_amount ?? 0) + (p.bonus_credit_amount ?? 0);
    return {
      id: p.id,
      productId: p.code,
      productType: p.product_type,
      displayName: p.name_ko,
      description: p.description_ko,
      amountKrw: p.amount_krw,
      currency: "KRW",
      tokenAmount: p.credit_amount,
      bonusTokenAmount: p.bonus_credit_amount,
      totalTokenAmount: total > 0 ? total : null,
      effectiveUnitPriceKrw: total > 0 ? Math.round(p.amount_krw / total) : null,
      isActive: p.is_active,
      isVisible: p.is_visible !== false,
      isPopular: !!p.is_popular,
      sortOrder: p.sort_order,
      pricingVersionId: p.pricing_version_id,
      adminNote: p.admin_note,
      effectiveFrom: p.effective_from,
      effectiveTo: p.effective_to,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  return NextResponse.json({
    activePricingVersion: activeVerRes.data
      ? {
          id: activeVerRes.data.id,
          versionName: activeVerRes.data.version_name,
          status: activeVerRes.data.status,
          baseTokenUnitPriceKrw: activeVerRes.data.base_token_unit_price_krw,
          signupBonusTokens: activeVerRes.data.signup_bonus_tokens,
          imageGenerationTokenCost: activeVerRes.data.image_generation_token_cost,
          pdfSinglePriceKrw: activeVerRes.data.pdf_single_price_krw,
          publishedAt: activeVerRes.data.published_at,
          memo: activeVerRes.data.memo,
        }
      : null,
    products: mappedProducts,
    consumptionRules: (rulesRes.data ?? []).map((r) => ({
      id: r.id,
      ruleKey: r.rule_key,
      displayName: r.display_name,
      tokenCost: r.token_cost,
      isActive: r.is_active,
      memo: r.memo,
      updatedAt: r.updated_at,
    })),
    versions: allVersionsRes.data ?? [],
    auditLogs: logsRes.data ?? [],
    adminId: getAdminIdFromRequest(req),
  });
}
