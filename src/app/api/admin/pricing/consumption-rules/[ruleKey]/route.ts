/**
 * PATCH /api/admin/pricing/consumption-rules/[ruleKey]
 *
 * 토큰 사용 규칙 수정 (image_generation.standard 등).
 *
 * 주의:
 *   * 이미 생성 중인 generation_jobs는 기존 token_cost snapshot 유지
 *     (현재 generation_jobs는 token_cost를 따로 저장하지 않으나, 향후 추가 시 snapshot 유지)
 *   * 새 이미지 생성 요청부터 변경된 token_cost 적용
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
  tokenCost?: number;
  isActive?: boolean;
  displayName?: string;
  memo?: string;
  changeReason: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ruleKey: string } },
) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.changeReason || body.changeReason.trim().length < 2) {
    return NextResponse.json({ error: "change_reason_required" }, { status: 400 });
  }

  const { data: current } = await admin
    .from("token_consumption_rules")
    .select("*")
    .eq("rule_key", params.ruleKey)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "rule_not_found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.tokenCost !== undefined) {
    if (body.tokenCost < 0) return NextResponse.json({ error: "token_cost_invalid" }, { status: 400 });
    update.token_cost = body.tokenCost;
  }
  if (body.isActive !== undefined) update.is_active = body.isActive;
  if (body.displayName !== undefined) update.display_name = body.displayName;
  if (body.memo !== undefined) update.memo = body.memo;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  const adminUserId = getAdminIdFromRequest(req);
  update.updated_by = adminUserId;
  update.updated_at = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("token_consumption_rules")
    .update(update)
    .eq("rule_key", params.ruleKey)
    .select("*")
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: "update_failed", hint: error?.message }, { status: 500 });
  }

  await admin.from("pricing_audit_logs").insert({
    actor_user_id: adminUserId,
    action: "consumption_rule.updated",
    target_type: "consumption_rule",
    target_id: updated.id,
    before_value: current,
    after_value: updated,
    reason: body.changeReason,
  });

  return NextResponse.json({ ok: true, rule: updated });
}
