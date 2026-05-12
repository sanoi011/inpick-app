"use client";

/**
 * INPICK Analytics — 클라이언트 사이드 trackClientEvent.
 *
 * 가이드: c:\Users\user\Desktop\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-4
 *
 * 사용:
 *   trackClientEvent("workflow_started", { entry_source: "cta_main" });
 *
 * - sendBeacon 우선 (페이지 이탈 시에도 전송 보장)
 * - anonymousId/sessionId는 localStorage에서 관리
 */

const ANON_ID_KEY = "inpick_anon_id";
const SESSION_ID_KEY = "inpick_session_id";
const SESSION_EXPIRY_KEY = "inpick_session_expiry";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = `anon_${uuid()}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const expiry = parseInt(localStorage.getItem(SESSION_EXPIRY_KEY) || "0", 10);
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id || expiry < now) {
      id = `sess_${uuid()}`;
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    localStorage.setItem(SESSION_EXPIRY_KEY, String(now + SESSION_TTL_MS));
    return id;
  } catch {
    return "";
  }
}

interface ClientTrackInput {
  props?: Record<string, unknown>;
  projectMode?: "apartment" | "photo_only" | "commercial";
  projectId?: string;
  funnel?: string;
  step?: string;
}

/**
 * 클라이언트 이벤트 기록. sendBeacon 우선, 실패 시 fetch keepalive 폴백.
 * 절대 throw X — UI 동작에 영향 없음.
 */
export function trackClientEvent(eventName: string, input: ClientTrackInput = {}): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      eventName,
      props: input.props || {},
      pagePath: window.location.pathname,
      referrer: document.referrer || undefined,
      occurredAt: new Date().toISOString(),
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      projectMode: input.projectMode,
      projectId: input.projectId,
      funnel: input.funnel,
      step: input.step,
    });

    const url = "/api/analytics/track";
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
    // 폴백: keepalive fetch
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // silent fail
  }
}
