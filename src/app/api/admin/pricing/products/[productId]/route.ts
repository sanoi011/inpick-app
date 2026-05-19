/**
 * PATCH /api/admin/pricing/products/[productId]
 *
 * 단일 상품 수정. productId는 payment_products.code (예: ai_credit_30).
 * 변경 사유(changeReason) 필수 → pricing_audit_logs에 before/after 기록.
 *
 * 검증:
 *   * amountKrw >= 100
 *   * tokenAmount >= 0, bonusTokenAmount >= 0
 *   * token_pack/ai_credit_pack은 tokenAmount + bonusTokenAmount > 0
 *   * pdf 상품은 amountKrw > 0
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
  displayName?: string;
  description?: string;
  amountKrw?: number;
  tokenAmount?: number;
  bonusTokenAmount?: number;
  isPopular?: boolean;
  isVisible?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  adminNote?: string;
  changeReason: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { productId: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.changeReason || body.changeReason.trim().length < 2) {
    return NextResponse.json({ error: "change_reason_required" }, { status: 400 });
  }

  // 기존 product 조회
  const { data: current, error: lookupErr } = await admin
    .from("payment_products")
    .select("*")
    .eq("code", params.productId)
    .maybeSingle();
  if (lookupErr || !current) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.displayName !== undefined) update.name_ko = body.displayName;
  if (body.description !== undefined) update.description_ko = body.description;
  if (body.amountKrw !== undefined) {
    if (body.amountKrw < 100) {
      return NextResponse.json({ error: "amount_too_low", hint: "최소 100원" }, { status: 400 });
    }
    update.amount_krw = body.amountKrw;
  }
  if (body.tokenAmount !== undefined) {
    if (body.tokenAmount < 0) return NextResponse.json({ error: "token_amount_invalid" }, { status: 400 });
    update.credit_amount = body.tokenAmount;
  }
  if (body.bonusTokenAmount !== undefined) {
    if (body.bonusTokenAmount < 0) return NextResponse.json({ error: "bonus_invalid" }, { status: 400 });
    update.bonus_credit_amount = body.bonusTokenAmount;
  }
  if (body.isPopular !== undefined) update.is_popular = body.isPopular;
  if (body.isVisible !== undefined) update.is_visible = body.isVisible;
  if (body.isActive !== undefined) update.is_active = body.isActive;
  if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;
  if (body.adminNote !== undefined) update.admin_note = body.adminNote;

  // token_pack 정합성 검증
  const ptype = current.product_type;
  if (ptype === "token_pack" || ptype === "ai_credit_pack") {
    const newToken = (update.credit_amount as number | undefined) ?? current.credit_amount;
    const newBonus = (update.bonus_credit_amount as number | undefined) ?? current.bonus_credit_amount;
    if (newToken + newBonus <= 0) {
      return NextResponse.json({ error: "token_pack_requires_positive_total" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  const adminUserId = getAdminIdFromRequest(req);
  update.updated_by = adminUserId;
  update.updated_at = new Date().toISOString();

  const { data: updated, error: updErr } = await admin
    .from("payment_products")
    .update(update)
    .eq("code", params.productId)
    .select("*")
    .single();
  if (updErr || !updated) {
    return NextResponse.json({ error: "update_failed", hint: updErr?.message }, { status: 500 });
  }

  // audit log
  await admin.from("pricing_audit_logs").insert({
    actor_user_id: adminUserId,
    action: "payment_product.updated",
    target_type: "payment_product",
    target_id: updated.id,
    before_value: current,
    after_value: updated,
    reason: body.changeReason,
  });

  return NextResponse.json({ ok: true, product: updated });
}
