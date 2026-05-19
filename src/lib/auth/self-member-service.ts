/**
 * 자체 회원관리 공통 서비스.
 * 가이드: §0-A-9, §0-A-10
 *
 * 단일 원칙:
 *   * Auth identity source of truth = Supabase auth.users
 *   * Consumer profile source of truth = public.consumer_profiles
 *   * 결제/토큰/entitlement owner = auth.users.id
 *
 * 금지:
 *   * consumer_profiles만 보고 로그인 가능/불가 결정
 *   * 이메일 문자열만으로 token/payment owner 결정
 *   * 주민등록번호 입력/저장/대조
 *   * service role key를 클라이언트에 노출
 */
import crypto from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createServiceClient> | null = null;
export function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── PII hashing (audit log용) ──────────────────────
// SHA-256으로 일관된 hash. salt는 환경변수 (선택). 충돌 탐지용이지 reversibility 필요 X.
const PII_SALT = process.env.AUTH_AUDIT_HASH_SALT || "inpick_audit_v1";

export function hashPii(input: string | null | undefined): string | null {
  if (!input) return null;
  return crypto.createHash("sha256").update(PII_SALT + ":" + input).digest("hex").slice(0, 32);
}

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[^0-9]/g, "");
}

export function normalizeEmail(input: string | null | undefined): string {
  if (!input) return "";
  return input.toLowerCase().trim();
}

// ─── auth_audit_events 기록 ─────────────────────────

export interface AuditEventInput {
  userId?: string | null;
  eventName: string;
  actorType?: "consumer" | "contractor" | "admin" | "system";
  provider?: string | null;
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  result: "success" | "failure" | "blocked" | "pending";
  errorCode?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  try {
    await (admin.from("auth_audit_events") as ReturnType<typeof admin.from>).insert({
      user_id: input.userId ?? null,
      event_name: input.eventName,
      actor_type: input.actorType ?? "consumer",
      provider: input.provider ?? null,
      email_hash: hashPii(input.email),
      phone_hash: hashPii(input.phone),
      ip_hash: hashPii(input.ip),
      user_agent: input.userAgent ?? null,
      result: input.result,
      error_code: input.errorCode ?? null,
      details: input.details ?? {},
    } as never);
  } catch (err) {
    // audit 실패가 본 흐름을 막지 않게 — console만
    console.warn("[auth_audit_events] insert failed:", err instanceof Error ? err.message : err);
  }
}

// ─── member_reconciliation_cases ────────────────────

export type MemberReconCaseType =
  | "auth_user_missing_profile"
  | "profile_missing_auth_user"
  | "email_user_cannot_login"
  | "email_unconfirmed_blocks_login"
  | "profile_rls_denied"
  | "phone_unique_blocks_signup"
  | "password_recovery_failed"
  | "password_recovery_abuse_suspected"
  | "oauth_profile_missing"
  | "self_oauth_identity_conflict";

export async function openMemberCase(input: {
  userId?: string | null;
  caseType: MemberReconCaseType;
  severity?: "low" | "medium" | "high" | "critical";
  email?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  try {
    await (admin.from("member_reconciliation_cases") as ReturnType<typeof admin.from>).insert({
      user_id: input.userId ?? null,
      case_type: input.caseType,
      severity: input.severity ?? "medium",
      email_hash: hashPii(input.email),
      details: input.details ?? {},
    } as never);
  } catch (err) {
    console.warn("[member_reconciliation_cases] insert failed:", err);
  }
}

// ─── ensureConsumerProfile ─────────────────────────
// auth.users에 있지만 consumer_profiles 없으면 최소 row 생성

export async function ensureConsumerProfile(input: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  provider?: string;
}): Promise<{ created: boolean; profileExists: boolean }> {
  const admin = getAdmin();
  if (!admin) return { created: false, profileExists: false };

  const { data: existing } = await admin
    .from("consumer_profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();

  if (existing) return { created: false, profileExists: true };

  // 신규 생성 (phone 없으면 빈 문자열 — phone UNIQUE 위반 가능성 회피용 안전 처리)
  const phone = normalizePhone(input.phone);
  if (!phone || phone.length < 10) {
    // phone 없으면 profile 생성 안 함 — 마이페이지에서 입력 유도
    await openMemberCase({
      userId: input.userId,
      caseType: "oauth_profile_missing",
      severity: "low",
      email: input.email,
      details: { reason: "phone_missing", provider: input.provider },
    });
    return { created: false, profileExists: false };
  }

  const { error } = await (admin.from("consumer_profiles") as ReturnType<typeof admin.from>).insert({
    id: input.userId,
    email: normalizeEmail(input.email),
    name: input.name?.trim() || input.email.split("@")[0],
    phone,
    provider: input.provider ?? "email",
    self_signup_completed_at: new Date().toISOString(),
  } as never);

  if (error) {
    await openMemberCase({
      userId: input.userId,
      caseType: "auth_user_missing_profile",
      severity: "medium",
      email: input.email,
      details: { reason: "insert_failed", error: error.message },
    });
    return { created: false, profileExists: false };
  }

  return { created: true, profileExists: true };
}

// ─── recovery challenge — 발급/검증/사용 ────────────

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10분

export function generateChallengeToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export async function createRecoveryChallenge(input: {
  userId: string;
  email: string;
  phone: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string } | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const { token, hash } = generateChallengeToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  const { error } = await (admin.from("password_recovery_challenges") as ReturnType<typeof admin.from>).insert({
    user_id: input.userId,
    challenge_hash: hash,
    email_hash: hashPii(input.email),
    phone_hash: hashPii(input.phone),
    status: "pending",
    expires_at: expiresAt,
    ip_hash: hashPii(input.ip ?? ""),
    user_agent: input.userAgent ?? null,
  } as never);

  if (error) {
    console.error("[createRecoveryChallenge] insert failed:", error.message);
    return null;
  }
  return { token };
}

export async function verifyRecoveryChallenge(token: string): Promise<{
  userId: string;
  challengeId: string;
} | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: challenge } = await (admin
    .from("password_recovery_challenges") as ReturnType<typeof admin.from>)
    .select("id, user_id, status, expires_at, attempts")
    .eq("challenge_hash", hash)
    .maybeSingle();

  const ch = challenge as { id: string; user_id: string; status: string; expires_at: string; attempts: number } | null;
  if (!ch) return null;
  if (ch.status !== "pending") return null;
  if (new Date(ch.expires_at) < new Date()) {
    await (admin.from("password_recovery_challenges") as ReturnType<typeof admin.from>)
      .update({ status: "expired" } as never)
      .eq("id", ch.id);
    return null;
  }

  return { userId: ch.user_id, challengeId: ch.id };
}

export async function markChallengeUsed(challengeId: string): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  await (admin.from("password_recovery_challenges") as ReturnType<typeof admin.from>)
    .update({ status: "used", used_at: new Date().toISOString() } as never)
    .eq("id", challengeId);
}

// ─── recovery rate limit (in-memory) ────────────────
// MVP: 동일 email_hash 기준 10분 5회. 추후 Redis 권장.

const recoveryAttempts = new Map<string, { count: number; firstAt: number }>();
const RECOVERY_WINDOW_MS = 10 * 60_000;
const RECOVERY_MAX = 5;

export function checkRecoveryRateLimit(emailHash: string): boolean {
  const now = Date.now();
  const cur = recoveryAttempts.get(emailHash);
  if (!cur || now - cur.firstAt > RECOVERY_WINDOW_MS) {
    recoveryAttempts.set(emailHash, { count: 1, firstAt: now });
    return true;
  }
  if (cur.count >= RECOVERY_MAX) return false;
  cur.count++;
  return true;
}

export function clearRecoveryRateLimit(emailHash: string): void {
  recoveryAttempts.delete(emailHash);
}
