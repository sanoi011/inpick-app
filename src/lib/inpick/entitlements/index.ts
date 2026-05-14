/**
 * Entitlements helper — PDF 무제한 / 단발 / 관리자 부여 검증.
 * 가이드: 2026-05-14 pricing v2
 *
 * 사용:
 *   const access = await checkEstimatePdfAccess({ userId, estimateId });
 *   if (access.granted) → 다운로드 진행
 *   else → 결제 모달 (estimate_pdf_single 9,900원)
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

// user_entitlements는 generated types에 없어 any 사용 (admin 권한 직접 쿼리)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export type EntitlementType =
  | "pdf_unlimited"
  | "estimate_pdf_single"
  | "subscription_pro"
  | "subscription_basic";

export type EntitlementSource = "payment" | "admin_grant" | "subscription" | "promo";

export interface EntitlementRow {
  id: string;
  user_id: string;
  entitlement_type: EntitlementType;
  source: EntitlementSource;
  source_id: string | null;
  scope_type: "estimate" | "project" | "global" | null;
  scope_id: string | null;
  granted_at: string;
  expires_at: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
}

/**
 * PDF 견적서 다운로드 권한 확인.
 *
 * 우선순위:
 *   1) pdf_unlimited (관리자/구독 무제한 — 영구 사용)
 *   2) estimate_pdf_single 중 미사용 + scope 일치
 *   3) 없음 → 결제 필요
 */
export async function checkEstimatePdfAccess(input: {
  userId: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
}): Promise<{
  granted: boolean;
  reason: "pdf_unlimited" | "single_available" | "payment_required";
  entitlementId?: string;
}> {
  const admin = getAdmin();
  if (!admin) return { granted: false, reason: "payment_required" };

  // 1) pdf_unlimited
  const { data: unlimited } = await admin
    .from("user_entitlements")
    .select("id, entitlement_type, expires_at, consumed_at, revoked_at")
    .eq("user_id", input.userId)
    .eq("entitlement_type", "pdf_unlimited")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (unlimited) {
    const row = unlimited as { id: string; expires_at: string | null };
    const expired = row.expires_at && new Date(row.expires_at) < new Date();
    if (!expired) {
      return { granted: true, reason: "pdf_unlimited", entitlementId: row.id };
    }
  }

  // 2) estimate_pdf_single — scope 일치 (estimate_id 또는 consumer_project_id)
  if (input.estimateId || input.consumerProjectId) {
    const orFilters: string[] = [];
    if (input.estimateId) orFilters.push(`and(scope_type.eq.estimate,scope_id.eq.${input.estimateId})`);
    if (input.consumerProjectId)
      orFilters.push(`and(scope_type.eq.project,scope_id.eq.${input.consumerProjectId})`);
    const { data: single } = await admin
      .from("user_entitlements")
      .select("id, scope_type, scope_id, consumed_at, revoked_at")
      .eq("user_id", input.userId)
      .eq("entitlement_type", "estimate_pdf_single")
      .is("consumed_at", null)
      .is("revoked_at", null)
      .or(orFilters.join(","))
      .limit(1)
      .maybeSingle();
    if (single) {
      return {
        granted: true,
        reason: "single_available",
        entitlementId: (single as { id: string }).id,
      };
    }
  }

  return { granted: false, reason: "payment_required" };
}

/**
 * 단발성 entitlement 사용 처리 (다운로드 직후 호출).
 * 무제한 권한은 consume 호출해도 NOOP.
 */
export async function consumeEntitlement(entitlementId: string): Promise<{ consumed: boolean }> {
  const admin = getAdmin();
  if (!admin) return { consumed: false };

  const { data, error } = await admin
    .from("user_entitlements")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", entitlementId)
    .is("consumed_at", null)
    .eq("entitlement_type", "estimate_pdf_single")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[entitlements] consume error:", error.message);
    return { consumed: false };
  }
  return { consumed: !!data };
}

/**
 * 결제 완료 후 estimate_pdf_single entitlement 발급.
 * idempotent: payment_id UNIQUE 1행만 발급.
 */
export async function grantEstimatePdfSingleAfterPayment(input: {
  userId: string;
  paymentId: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
}): Promise<{ entitlementId: string }> {
  const admin = getAdmin();
  if (!admin) throw new Error("service role not configured");

  // 중복 발급 방지: 같은 payment_id에 이미 발급된 entitlement
  const { data: existing } = await admin
    .from("user_entitlements")
    .select("id")
    .eq("source", "payment")
    .eq("source_id", input.paymentId)
    .eq("entitlement_type", "estimate_pdf_single")
    .maybeSingle();
  if (existing) return { entitlementId: (existing as { id: string }).id };

  const scopeType: "estimate" | "project" | null = input.estimateId
    ? "estimate"
    : input.consumerProjectId
      ? "project"
      : null;
  const scopeId = input.estimateId ?? input.consumerProjectId ?? null;

  const { data, error } = await admin
    .from("user_entitlements")
    .insert({
      user_id: input.userId,
      entitlement_type: "estimate_pdf_single",
      source: "payment",
      source_id: input.paymentId,
      scope_type: scopeType,
      scope_id: scopeId,
      metadata: { granted_via: "estimate_pdf_purchase" },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`grant failed: ${error?.message}`);
  return { entitlementId: (data as { id: string }).id };
}

/**
 * 관리자 PDF 무제한 부여 (전역).
 */
export async function grantPdfUnlimitedByAdmin(input: {
  userId: string;
  adminId: string;
  reason?: string;
  expiresAt?: string | null;
}): Promise<{ entitlementId: string; alreadyGranted: boolean }> {
  const admin = getAdmin();
  if (!admin) throw new Error("service role not configured");

  // 이미 활성 무제한 권한 있으면 그대로 반환
  const { data: existing } = await admin
    .from("user_entitlements")
    .select("id")
    .eq("user_id", input.userId)
    .eq("entitlement_type", "pdf_unlimited")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { entitlementId: (existing as { id: string }).id, alreadyGranted: true };
  }

  const { data, error } = await admin
    .from("user_entitlements")
    .insert({
      user_id: input.userId,
      entitlement_type: "pdf_unlimited",
      source: "admin_grant",
      source_id: input.adminId,
      scope_type: "global",
      expires_at: input.expiresAt ?? null,
      metadata: { reason: input.reason ?? "admin grant", granted_via: "admin_ui" },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`admin grant failed: ${error?.message}`);
  return { entitlementId: (data as { id: string }).id, alreadyGranted: false };
}

export async function revokeEntitlement(entitlementId: string, reason: string): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from("user_entitlements")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("id", entitlementId)
    .is("revoked_at", null);
  return !error;
}

export async function listUserEntitlements(userId: string): Promise<EntitlementRow[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });
  return (data as EntitlementRow[] | null) ?? [];
}
