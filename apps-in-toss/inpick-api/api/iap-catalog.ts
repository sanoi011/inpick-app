import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppsInTossPayError,
  getAppsInTossPaymentContext,
} from "../lib/apps-in-toss-pay.js";
import { applyCors, json } from "../lib/http.js";

type ProductRow = {
  code: string;
  product_type: string;
  name_ko: string;
  description_ko?: string | null;
  amount_krw: number;
  credit_amount: number | null;
  bonus_credit_amount: number | null;
  is_popular?: boolean | null;
  is_visible?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  apps_in_toss_sku: string;
  apps_in_toss_product_type: string;
  apps_in_toss_sale_amount_krw?: number | null;
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  applyCors(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "GET") {
    return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const context = await getAppsInTossPaymentContext(request);
    const now = Date.now();
    const [productsResult, pricingResult] = await Promise.all([
      context.admin
        .from("payment_products")
        .select(
          "code, product_type, name_ko, description_ko, amount_krw, credit_amount, bonus_credit_amount, is_popular, is_visible, effective_from, effective_to, apps_in_toss_sku, apps_in_toss_product_type, apps_in_toss_sale_amount_krw",
        )
        .eq("is_active", true)
        .eq("apps_in_toss_enabled", true)
        .eq("apps_in_toss_product_type", "CONSUMABLE")
        .not("apps_in_toss_sku", "is", null)
        .order("sort_order", { ascending: true }),
      context.admin
        .from("pricing_versions")
        .select("image_generation_token_cost")
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (productsResult.error) {
      console.error("[inpick-toss-api/iap-catalog]", productsResult.error);
      return json(response, 503, {
        error: "IAP_CATALOG_NOT_READY",
        hint: "앱인토스 IAP 상품 매핑 마이그레이션과 SKU 등록을 확인해 주세요.",
      });
    }

    const products = ((productsResult.data || []) as ProductRow[])
      .filter(
        (product) =>
          product.is_visible !== false &&
          (!product.effective_from ||
            Date.parse(product.effective_from) <= now) &&
          (!product.effective_to || Date.parse(product.effective_to) >= now) &&
          ["ai_credit_pack", "token_pack", "pdf_estimate_single", "pdf_entitlement"].includes(
            product.product_type,
          ),
      )
      .map((product) => ({
        productId: product.code,
        productType: product.product_type,
        displayName: product.name_ko,
        description: product.description_ko || null,
        amountKrw: Number(
          product.apps_in_toss_sale_amount_krw || product.amount_krw,
        ),
        tokenAmount: Number(product.credit_amount || 0),
        bonusTokenAmount: Number(product.bonus_credit_amount || 0),
        totalTokenAmount:
          Number(product.credit_amount || 0) +
          Number(product.bonus_credit_amount || 0),
        isPopular: product.is_popular === true,
        sku: product.apps_in_toss_sku,
        iapProductType: product.apps_in_toss_product_type,
      }));

    return json(response, 200, {
      pricing: {
        imageGenerationTokenCost: Number(
          pricingResult.data?.image_generation_token_cost || 1,
        ),
      },
      products,
    });
  } catch (error) {
    console.error("[inpick-toss-api/iap-catalog]", error);
    if (error instanceof AppsInTossPayError) {
      return json(response, error.status, {
        error: error.code,
        hint: error.message,
      });
    }
    return json(response, 500, { error: "IAP_CATALOG_FAILED" });
  }
}
