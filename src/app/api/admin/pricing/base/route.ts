/**
 * PATCH /api/admin/pricing/base
 *
 * active pricing version 의 기준값 수정.
 * - baseTokenUnitPriceKrw / signupBonusTokens / imageGenerationTokenCost / pdfSinglePriceKrw
 *
 * 정책:
 *   * MVP: active version 직접 update + audit log
 *   * applyMode = 'base_only' | 'auto_recalculate_packages' | 'manual'
 *     - base_only: 기준 단가만 변경, 패키지 가격은 그대로
 *     - auto_recalculate_packages: token_amount × base_unit_price 로 패키지 재계산 (보너스 제외)
 *     - manual: 기준 단가만 변경 (= base_only)
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

interface PatchBody {
  baseTokenUnitPriceKrw?: number;
  signupBonusTokens?: number;
  imageGenerationTokenCost?: number;
  pdfSinglePriceKrw?: number;
  applyMode?: "base_only" | "auto_recalculate_packages" | "manual";
  changeReason: string;
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.changeReason || body.changeReason.trim().length < 2) {
    return NextResponse.json({ error: "change_reason_required" }, { status: 400 });
  }

  const { data: active } = await admin.from("pricing_versions").select("*").eq("status", "active").maybeSingle();
  if (!active) {
    return NextResponse.json({ error: "no_active_version" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.baseTokenUnitPriceKrw !== undefined) {
    if (body.baseTokenUnitPriceKrw < 1) return NextResponse.json({ error: "base_price_invalid" }, { status: 400 });
    update.base_token_unit_price_krw = body.baseTokenUnitPriceKrw;
  }
  if (body.signupBonusTokens !== undefined) {
    if (body.signupBonusTokens < 0) return NextResponse.json({ error: "signup_bonus_invalid" }, { status: 400 });
    update.signup_bonus_tokens = body.signupBonusTokens;
  }
  if (body.imageGenerationTokenCost !== undefined) {
    if (body.imageGenerationTokenCost < 0) return NextResponse.json({ error: "image_cost_invalid" }, { status: 400 });
    update.image_generation_token_cost = body.imageGenerationTokenCost;
  }
  if (body.pdfSinglePriceKrw !== undefined) {
    if (body.pdfSinglePriceKrw < 0) return NextResponse.json({ error: "pdf_price_invalid" }, { status: 400 });
    update.pdf_single_price_krw = body.pdfSinglePriceKrw;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  const adminUserId = getAdminIdFromRequest(req);
  update.updated_at = new Date().toISOString();

  const { data: updated, error: verErr } = await admin
    .from("pricing_versions")
    .update(update)
    .eq("id", active.id)
    .select("*")
    .single();
  if (verErr || !updated) {
    return NextResponse.json({ error: "version_update_failed", hint: verErr?.message }, { status: 500 });
  }

  // PDF 단발 상품 가격 동기화 (관리자가 pdfSinglePriceKrw 변경 시)
  if (body.pdfSinglePriceKrw !== undefined) {
    await admin
      .from("payment_products")
      .update({ amount_krw: body.pdfSinglePriceKrw, updated_at: new Date().toISOString() })
      .eq("product_type", "pdf_estimate_single");
  }

  // applyMode 처리 — 토큰 패키지 자동 재계산
  let packagesRecalculated = 0;
  if (body.applyMode === "auto_recalculate_packages" && body.baseTokenUnitPriceKrw !== undefined) {
    const { data: tokenPacks } = await admin
      .from("payment_products")
      .select("id, code, credit_amount")
      .in("product_type", ["token_pack", "ai_credit_pack"]);
    for (const p of (tokenPacks ?? []) as Array<{ id: string; code: string; credit_amount: number }>) {
      const newAmount = p.credit_amount * body.baseTokenUnitPriceKrw;
      await admin
        .from("payment_products")
        .update({ amount_krw: newAmount, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      packagesRecalculated++;
    }
  }

  // audit log
  await admin.from("pricing_audit_logs").insert({
    actor_user_id: adminUserId,
    action: "pricing_version.updated",
    target_type: "pricing_version",
    target_id: updated.id,
    before_value: active,
    after_value: updated,
    reason: body.changeReason,
  });

  return NextResponse.json({
    ok: true,
    pricingVersion: updated,
    packagesRecalculated,
    applyMode: body.applyMode ?? "base_only",
  });
}
