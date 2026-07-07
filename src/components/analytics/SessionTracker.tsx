"use client";

/**
 * 세션 시작 계측 — 루트 layout에 1회 마운트.
 *
 * getSessionId()의 30분 TTL 로직으로 세션 id를 얻고,
 * "마지막으로 발화한 세션 id"를 localStorage에 기록해 같은 세션에서
 * 페이지 이동/새로고침이 일어나도 session_started는 세션당 1회만 발화한다.
 *
 * 실패해도 앱 동작에 영향 없음 (trackClientEvent는 절대 throw X).
 */
import { useEffect } from "react";
import { trackClientEvent, getSessionId } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

const LAST_TRACKED_SESSION_KEY = "inpick_session_started_id";

export default function SessionTracker() {
  useEffect(() => {
    try {
      const sessionId = getSessionId();
      if (!sessionId) return; // localStorage 불가 환경 등
      const lastTracked = localStorage.getItem(LAST_TRACKED_SESSION_KEY);
      if (lastTracked === sessionId) return; // 이미 이 세션에서 발화함
      localStorage.setItem(LAST_TRACKED_SESSION_KEY, sessionId);
      trackClientEvent(AnalyticsEvents.SessionStarted, {
        props: {
          entry_path: window.location.pathname,
          referrer: document.referrer || undefined,
        },
      });
    } catch {
      // silent fail — 계측 실패가 렌더링을 막지 않음
    }
  }, []);

  return null;
}
