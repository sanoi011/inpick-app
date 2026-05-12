/**
 * POST /api/analytics/track
 *
 * 클라이언트가 sendBeacon으로 전송한 이벤트를 받아 analytics_events에 기록.
 *
 * 보안:
 *  - 인증 없이 호출 가능 (anonymous 사용자도 추적)
 *  - PII는 sanitizer가 자동 제거
 *  - rate limit은 미들웨어 또는 별도 처리 (현재는 미적용)
 */
import { NextRequest, NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/analytics/track";
import type { ActorType } from "@/lib/analytics/events";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClientEventPayload {
  eventName: string;
  props?: Record<string, unknown>;
  pagePath?: string;
  referrer?: string;
  occurredAt?: string;
  anonymousId?: string;
  sessionId?: string;
  projectMode?: "apartment" | "photo_only" | "commercial";
  projectId?: string;
  funnel?: string;
  step?: string;
}

export async function POST(req: NextRequest) {
  let body: ClientEventPayload;
  try {
    body = (await req.json()) as ClientEventPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  if (!body.eventName) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // 인증된 사용자면 user_id 자동 부여
  let userId: string | undefined;
  let actorType: ActorType = "anonymous";
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
      actorType = "consumer";
    }
  } catch {
    // 인증 실패 — anonymous로 진행
  }

  const userAgent = req.headers.get("user-agent") || undefined;
  const referrer = body.referrer || req.headers.get("referer") || undefined;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined;

  await trackServerEvent({
    eventName: body.eventName,
    actorType,
    userId,
    anonymousId: body.anonymousId,
    sessionId: body.sessionId,
    projectId: body.projectId,
    projectMode: body.projectMode,
    funnel: body.funnel,
    step: body.step,
    source: "server",
    pagePath: body.pagePath,
    referrer,
    userAgent,
    ip,
    props: body.props,
  });

  return NextResponse.json({ ok: true });
}
