/**
 * GET /api/admin/analytics/by-provider?period=today|week|month
 *
 * 로그인 제공사(google/kakao/naver/apple/email)별 세분화 대시보드 데이터.
 *  - 유저수: auth.users.app_metadata.provider 기준 (단일 진실원)
 *  - 활동데이터: analytics_events를 user_id→provider 맵으로 버킷팅
 *  - 감성데이터: user_material_events를 동일 맵으로 버킷팅
 *  - 인구통계: user_demographics(성별/연령대) — provider 동의 승인 시에만 채워짐 → 커버리지 표시
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS = ["google", "kakao", "naver", "apple", "email"] as const;
type Provider = (typeof PROVIDERS)[number];

// 활동데이터: 대시보드에 노출할 핵심 이벤트
const ACTIVITY_EVENTS: Record<string, string> = {
  workflow_started: "워크플로 시작",
  chat_message_sent: "AI 채팅",
  image_generation_completed: "이미지 생성",
  estimate_generated: "견적 생성",
  estimate_requested: "견적 요청(RFQ)",
  material_selected: "자재 선택",
  pdf_issued: "PDF 발급",
  iap_verified: "결제 완료",
};

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function periodStart(period: string): string {
  const now = new Date();
  if (period === "today") now.setHours(0, 0, 0, 0);
  else if (period === "month") now.setDate(now.getDate() - 30);
  else now.setDate(now.getDate() - 7);
  return now.toISOString();
}

function normProvider(p: string | undefined | null): Provider {
  const v = (p || "email").toLowerCase();
  return (PROVIDERS as readonly string[]).includes(v) ? (v as Provider) : "email";
}

function emptyBucket() {
  return {
    userCount: 0,
    activity: Object.fromEntries(Object.keys(ACTIVITY_EVENTS).map((k) => [k, 0])) as Record<string, number>,
    activeUsers: new Set<string>(),
    emotion: { events: 0, byMood: {} as Record<string, number>, byPalette: {} as Record<string, number> },
    demographics: {
      withGender: 0,
      withAge: 0,
      gender: { male: 0, female: 0 } as Record<string, number>,
      ageRange: {} as Record<string, number>,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const period = req.nextUrl.searchParams.get("period") ?? "week";
  const since = periodStart(period);

  // 1) user_id → provider 맵 (auth.users 페이지네이션)
  const userProvider = new Map<string, Provider>();
  const buckets: Record<Provider, ReturnType<typeof emptyBucket>> = {
    google: emptyBucket(), kakao: emptyBucket(), naver: emptyBucket(),
    apple: emptyBucket(), email: emptyBucket(),
  };
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      const p = normProvider(u.app_metadata?.provider as string);
      userProvider.set(u.id, p);
      buckets[p].userCount++;
    }
    if (data.users.length < 200) break;
  }

  // 2) 인구통계 (user_demographics) — 테이블 없으면 조용히 스킵
  try {
    const { data: demos } = await admin
      .from("user_demographics")
      .select("user_id, provider, gender, age_range");
    for (const d of (demos ?? []) as Array<{ user_id: string; provider: string; gender: string | null; age_range: string | null }>) {
      const p = normProvider(d.provider);
      const b = buckets[p];
      if (d.gender) { b.demographics.withGender++; b.demographics.gender[d.gender] = (b.demographics.gender[d.gender] ?? 0) + 1; }
      if (d.age_range) { b.demographics.withAge++; b.demographics.ageRange[d.age_range] = (b.demographics.ageRange[d.age_range] ?? 0) + 1; }
    }
  } catch { /* 마이그레이션 전 */ }

  // 3) 활동데이터 (analytics_events) — 기간 내, 관심 이벤트만, user_id로 버킷팅
  const activityNames = Object.keys(ACTIVITY_EVENTS);
  const { data: events } = await admin
    .from("analytics_events")
    .select("event_name, user_id, occurred_at")
    .in("event_name", activityNames)
    .eq("internal_user", false)
    .gte("occurred_at", since)
    .limit(50000);
  for (const e of (events ?? []) as Array<{ event_name: string; user_id: string | null }>) {
    if (!e.user_id) continue;
    const p = userProvider.get(e.user_id);
    if (!p) continue;
    const b = buckets[p];
    b.activity[e.event_name] = (b.activity[e.event_name] ?? 0) + 1;
    b.activeUsers.add(e.user_id);
  }

  // 4) 감성데이터 (user_material_events) — 테이블 없으면 스킵
  try {
    const { data: mat } = await admin
      .from("user_material_events")
      .select("user_id, event_type, palette_id, detected_moods, created_at")
      .gte("created_at", since)
      .limit(50000);
    for (const m of (mat ?? []) as Array<{ user_id: string | null; palette_id: string | null; detected_moods: string[] | null }>) {
      if (!m.user_id) continue;
      const p = userProvider.get(m.user_id);
      if (!p) continue;
      const b = buckets[p];
      b.emotion.events++;
      if (m.palette_id) b.emotion.byPalette[m.palette_id] = (b.emotion.byPalette[m.palette_id] ?? 0) + 1;
      for (const mood of m.detected_moods ?? []) b.emotion.byMood[mood] = (b.emotion.byMood[mood] ?? 0) + 1;
    }
  } catch { /* 마이그레이션 전 */ }

  // 5) 직렬화 (Set → 카운트)
  const result = PROVIDERS.map((p) => {
    const b = buckets[p];
    return {
      provider: p,
      userCount: b.userCount,
      activeUsers: b.activeUsers.size,
      activity: b.activity,
      emotion: {
        events: b.emotion.events,
        topMoods: Object.entries(b.emotion.byMood).sort((a, c) => c[1] - a[1]).slice(0, 5),
        topPalettes: Object.entries(b.emotion.byPalette).sort((a, c) => c[1] - a[1]).slice(0, 5),
      },
      demographics: {
        withGender: b.demographics.withGender,
        withAge: b.demographics.withAge,
        genderCoverage: b.userCount ? Math.round((b.demographics.withGender / b.userCount) * 100) : 0,
        gender: b.demographics.gender,
        ageRange: Object.entries(b.demographics.ageRange).sort((a, c) => a[0].localeCompare(c[0])),
      },
    };
  });

  const totalUsers = result.reduce((s, r) => s + r.userCount, 0);
  return NextResponse.json({
    period,
    totalUsers,
    activityLabels: ACTIVITY_EVENTS,
    providers: result,
  });
}
