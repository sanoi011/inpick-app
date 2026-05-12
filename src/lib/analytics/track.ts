/**
 * INPICK Analytics — server-side trackServerEvent.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-4
 *
 * 사용:
 *   await trackServerEvent({
 *     eventName: AnalyticsEvents.ImageGenerationCompleted,
 *     actorType: "consumer",
 *     userId,
 *     projectId,
 *     projectMode: "commercial",
 *     props: { model, latency_ms, credit_charged },
 *   });
 *
 * 정책:
 *  - 절대 throw 하지 않음 (analytics 실패가 비즈니스 로직 영향 X)
 *  - PII는 sanitizer가 자동 제거
 *  - INTERNAL_USER_IDS 환경변수에 포함된 사용자는 internal_user=true (대표/테스터 제외)
 */
import { createClient } from "@supabase/supabase-js";
import { sanitizeAnalyticsProps, hashForAnalytics } from "./sanitize";
import type { ActorType, AnalyticsEventName, ProjectModeForAnalytics } from "./events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

function getInternalUserIds(): Set<string> {
  const raw = process.env.INTERNAL_USER_IDS || "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function isInternalUser(userId?: string): boolean {
  if (!userId) return false;
  return getInternalUserIds().has(userId);
}

export interface TrackServerEventInput {
  eventName: AnalyticsEventName | string;
  eventVersion?: number;
  actorType: ActorType;
  userId?: string;
  contractorId?: string;
  adminId?: string;
  anonymousId?: string;
  sessionId?: string;

  projectId?: string;
  rfqId?: string;
  bidId?: string;
  contractId?: string;
  estimateId?: string;
  renderId?: string;
  scopeSnapshotId?: string;

  projectMode?: ProjectModeForAnalytics;
  funnel?: string;
  step?: string;

  source?: "server" | "api" | "worker" | "system";
  pagePath?: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;

  props?: Record<string, unknown>;
}

/**
 * 서버에서 호출하는 행동 이벤트 기록.
 * 절대 throw 하지 않음.
 */
export async function trackServerEvent(input: TrackServerEventInput): Promise<void> {
  try {
    const admin = getAdmin();
    if (!admin) return; // env 미설정 시 skip

    const sanitizedProps = sanitizeAnalyticsProps(input.props ?? {});
    const ipHash = input.ip ? hashForAnalytics(input.ip) : null;

    await admin.from("analytics_events").insert({
      event_name: input.eventName,
      event_version: input.eventVersion ?? 1,
      actor_type: input.actorType,
      user_id: input.userId ?? null,
      contractor_id: input.contractorId ?? null,
      admin_id: input.adminId ?? null,
      anonymous_id: input.anonymousId ?? null,
      session_id: input.sessionId ?? null,
      project_id: input.projectId ?? null,
      rfq_id: input.rfqId ?? null,
      bid_id: input.bidId ?? null,
      contract_id: input.contractId ?? null,
      estimate_id: input.estimateId ?? null,
      render_id: input.renderId ?? null,
      scope_snapshot_id: input.scopeSnapshotId ?? null,
      project_mode: input.projectMode ?? null,
      funnel: input.funnel ?? null,
      step: input.step ?? null,
      source: input.source ?? "server",
      page_path: input.pagePath ?? null,
      referrer: input.referrer ?? null,
      user_agent: input.userAgent ?? null,
      ip_hash: ipHash,
      props: sanitizedProps,
      pii_redacted: true,
      internal_user: isInternalUser(input.userId),
    });
  } catch (err) {
    // 절대 throw X — 비즈니스 로직 영향 차단
    console.warn(
      `[analytics] track failed for ${input.eventName}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Fire-and-forget 변형. await 안 해도 됨 (response time 영향 0).
 */
export function trackServerEventAsync(input: TrackServerEventInput): void {
  void trackServerEvent(input);
}

/**
 * identity link 기록 — anonymous → user 매핑.
 */
export async function linkIdentity(input: {
  anonymousId: string;
  userId?: string;
  contractorId?: string;
  source: string;
}): Promise<void> {
  try {
    const admin = getAdmin();
    if (!admin) return;
    await admin.from("analytics_identity_links").insert({
      anonymous_id: input.anonymousId,
      user_id: input.userId ?? null,
      contractor_id: input.contractorId ?? null,
      source: input.source,
    });
  } catch (err) {
    console.warn("[analytics] linkIdentity failed:", err);
  }
}
