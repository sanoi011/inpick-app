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
 * v2 정책 (2026-05-14, pricing-saas-flow):
 *   "1회 다운로드권" → "견적서 1건 발급권"
 *
 * 우선순위:
 *   1) pdf_unlimited (관리자/구독 무제한 — 영구 사용)
 *   2) estimate_pdf_single 중 같은 estimate_id + estimate_version, asset_url 채워진 것
 *      → 재다운로드 무료 (reissue_of_same_version)
 *   3) estimate_pdf_single 중 미사용(asset_url null + consumed_at null)
 *      + scope 일치 또는 복구용 미지정 scope
 *      → 새 발급 사용 가능 (single_available)
 *   4) 없음 → 결제 필요
 */
export async function checkEstimatePdfAccess(input: {
  userId: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
  /** 새 정책: 같은 version은 재다운로드 무료. 미제공 시 v3 기본 사용 */
  estimateVersion?: string | null;
}): Promise<{
  granted: boolean;
  reason:
    | "pdf_unlimited"
    | "reissue_of_same_version"
    | "single_available"
    | "payment_required";
  entitlementId?: string;
  /** 재다운로드 가능 시 기존 asset URL */
  assetUrl?: string | null;
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

  // 2) 같은 estimate_id + estimate_version 발급 이력 → 재다운로드 무료
  if (input.estimateId && input.estimateVersion) {
    const { data: reissue } = await admin
      .from("user_entitlements")
      .select("id, asset_url, estimate_version")
      .eq("user_id", input.userId)
      .eq("entitlement_type", "estimate_pdf_single")
      .eq("estimate_id", input.estimateId)
      .eq("estimate_version", input.estimateVersion)
      .not("asset_url", "is", null)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (reissue) {
      return {
        granted: true,
        reason: "reissue_of_same_version",
        entitlementId: (reissue as { id: string }).id,
        assetUrl: (reissue as { asset_url: string }).asset_url,
      };
    }
  }

  // 3) estimate_pdf_single — 미사용 (asset_url null + consumed_at null) + scope 일치
  if (input.estimateId || input.consumerProjectId) {
    const orFilters: string[] = [];
    if (input.estimateId) orFilters.push(`and(scope_type.eq.estimate,scope_id.eq.${input.estimateId})`);
    if (input.consumerProjectId)
      orFilters.push(`and(scope_type.eq.project,scope_id.eq.${input.consumerProjectId})`);
    // IAP 지급 당시 앱이 종료되거나 기기가 바뀌면 주문 복구 콜백에는 원래 프로젝트
    // 문맥이 없을 수 있다. 이때 발급한 scope 미지정 단발권은 1회용 바우처로 사용한다.
    orFilters.push("and(scope_type.is.null,scope_id.is.null)");
    const { data: single } = await admin
      .from("user_entitlements")
      .select("id, scope_type, scope_id, consumed_at, revoked_at, asset_url")
      .eq("user_id", input.userId)
      .eq("entitlement_type", "estimate_pdf_single")
      .is("consumed_at", null)
      .is("asset_url", null)
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
export async function consumeEntitlement(input: {
  entitlementId: string;
  userId: string;
}): Promise<{ consumed: boolean }> {
  const admin = getAdmin();
  if (!admin) return { consumed: false };

  const { data, error } = await admin
    .from("user_entitlements")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", input.entitlementId)
    .eq("user_id", input.userId)
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
 * PDF 발급 성공 후 entitlement에 asset 정보 등록.
 * 가이드: §3-3, §11 P5
 *
 * 정책:
 *   * PDF asset 생성 성공 후 호출 → 같은 estimateVersion 재다운로드 가능
 *   * estimate_id + estimate_version 추적 (없으면 단발권 fallback)
 *   * 이미 issued된 entitlement는 idempotent
 *
 * 호출 위치: PDF 생성 라우트에서 PDF asset이 Storage에 저장된 직후.
 */
export async function markPdfEntitlementIssued(input: {
  entitlementId: string;
  estimateId: string;
  estimateVersion: string;
  assetUrl: string;
  assetPath?: string;
}): Promise<{ issued: boolean; alreadyIssued: boolean }> {
  const admin = getAdmin();
  if (!admin) return { issued: false, alreadyIssued: false };

  // 1) 현재 상태 확인
  const { data: cur } = await admin
    .from("user_entitlements")
    .select("id, asset_url, consumed_at")
    .eq("id", input.entitlementId)
    .maybeSingle();
  if (!cur) return { issued: false, alreadyIssued: false };
  if ((cur as { asset_url: string | null }).asset_url) {
    return { issued: true, alreadyIssued: true };
  }

  // 2) asset_url 등록 + estimate_version 추적
  const now = new Date().toISOString();
  const { error } = await admin
    .from("user_entitlements")
    .update({
      estimate_id: input.estimateId,
      estimate_version: input.estimateVersion,
      asset_url: input.assetUrl,
      asset_path: input.assetPath ?? null,
      issued_at: now,
      consumed_at: now, // asset 발급 = 권한 사용 확정
    })
    .eq("id", input.entitlementId)
    .is("asset_url", null);
  if (error) {
    console.error("[entitlements] markPdfEntitlementIssued error:", error.message);
    return { issued: false, alreadyIssued: false };
  }
  return { issued: true, alreadyIssued: false };
}

/**
 * PDF asset 부재 자동 감지 (관리자 reconciliation 스캐너용).
 *
 * 조건: consumed_at 있지만 asset_url 없는 estimate_pdf_single entitlement
 *       → 사용자가 권한은 썼는데 PDF는 못 받은 상태
 */
export async function detectMissingPdfAssets(): Promise<
  Array<{ id: string; user_id: string; consumed_at: string }>
> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("user_entitlements")
    .select("id, user_id, consumed_at")
    .eq("entitlement_type", "estimate_pdf_single")
    .not("consumed_at", "is", null)
    .is("asset_url", null)
    .is("revoked_at", null)
    .order("consumed_at", { ascending: false })
    .limit(100);
  return (data as Array<{ id: string; user_id: string; consumed_at: string }> | null) ?? [];
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
 * 토큰 차감으로 PDF 단건 발급 (앱 IAP 경로 — 피드백 2026-07-02 #6 "보유 토큰 우선 차감").
 * 중복 방지: 같은 ledgerId(토큰 차감 건)에 이미 발급된 entitlement 재사용.
 */
export async function grantEstimatePdfSingleWithTokens(input: {
  userId: string;
  ledgerId: string;
  estimateId?: string | null;
  consumerProjectId?: string | null;
}): Promise<{ entitlementId: string }> {
  const admin = getAdmin();
  if (!admin) throw new Error("service role not configured");

  const { data: existing } = await admin
    .from("user_entitlements")
    .select("id")
    .eq("source", "token_spend")
    .eq("source_id", input.ledgerId)
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
      source: "token_spend",
      source_id: input.ledgerId,
      scope_type: scopeType,
      scope_id: scopeId,
      metadata: { granted_via: "estimate_pdf_token_spend" },
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
