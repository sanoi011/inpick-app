/**
 * GET /api/mobile/payment-products?platform=ios|android
 *
 * 앱에서 구매 가능한 상품만 (sale_channels 매칭).
 * 가이드: §12-1
 */
import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform");
  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json({ error: "platform must be ios or android" }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const { data: products } = await admin
    .from("payment_products")
    .select("code, product_type, product_kind, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, app_store_product_id, google_play_product_id, sale_channels, policy_risk_level, is_active, is_visible")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  type Row = {
    code: string;
    product_type: string;
    product_kind: string | null;
    name_ko: string;
    description_ko: string | null;
    amount_krw: number;
    credit_amount: number | null;
    bonus_credit_amount: number | null;
    app_store_product_id: string | null;
    google_play_product_id: string | null;
    sale_channels: Record<string, boolean>;
    policy_risk_level: string;
    is_active: boolean;
    is_visible: boolean | null;
  };

  const mapped = ((products ?? []) as Row[])
    .filter((p) => p.is_visible !== false)
    .map((p) => {
      const appProductId = platform === "ios" ? p.app_store_product_id : p.google_play_product_id;
      const channels = p.sale_channels ?? {};
      const allowedChannel = platform === "ios"
        ? channels.ios_storekit || channels.ios_external_kr
        : channels.android_play_billing || channels.android_alternative_billing_kr;

      let policyStatus: "allowed" | "blocked" | "review_required" = "review_required";
      let policyMessage: string | undefined;

      if (!appProductId) {
        policyStatus = "blocked";
        policyMessage = "앱마켓 productId 미등록";
      } else if (!allowedChannel) {
        policyStatus = "review_required";
        policyMessage = "앱 내 결제 정책 검토 후 활성화 필요";
      } else if (p.product_kind === "digital_token" || p.product_kind === "digital_entitlement") {
        policyStatus = "allowed";
      } else if (p.product_kind === "offline_service") {
        policyStatus = "allowed";
      }

      const total = (p.credit_amount ?? 0) + (p.bonus_credit_amount ?? 0);
      return {
        internalProductId: p.code,
        appProductId,
        productKind: p.product_kind,
        displayName: p.name_ko,
        description: p.description_ko,
        amountKrw: p.amount_krw,
        tokenAmount: p.credit_amount,
        bonusTokenAmount: p.bonus_credit_amount,
        totalTokenAmount: total > 0 ? total : null,
        saleChannel: platform === "ios" ? "ios_storekit" : "android_play_billing",
        provider: platform === "ios" ? "app_store" : "google_play",
        policyStatus,
        policyMessage,
      };
    });

  return NextResponse.json(
    { platform, products: mapped },
    { headers: { "Cache-Control": "no-store" } }
  );
}
