/**
 * GET  /api/service-reviews?service=full_interior|partial|material_preview|all&limit=
 *      → { reviews: ServiceReview[], aggregate: { total, avg, byService }, source }
 * POST /api/service-reviews { serviceType, rating, content, title?, region?, authorName? }
 *      → 로그인 사용자만 작성
 *
 * 아정당(ajd.co.kr) 스타일 서비스별 후기. (사업자 리뷰는 /api/reviews 별도)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapDbReview, maskName, type ReviewServiceType } from "@/types/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE_TYPES: ReviewServiceType[] = ["full_interior", "partial", "material_preview"];

// 테이블 미생성(마이그레이션 미적용) 시 노출용 mock — 적용 후엔 DB 시드가 대체
const MOCK = [
  { service_type: "full_interior", rating: 5, content: "주소만 넣었는데 도면이랑 견적이 바로 나와서 놀랐어요. 어디에 돈이 드는지 한눈에 보였습니다.", author_name: "김민수", region: "대전 유성구", created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
  { service_type: "full_interior", rating: 5, content: "여러 업체 견적 비교가 이렇게 쉬울 줄 몰랐어요. 표준 단가 기준이라 안심됐습니다.", author_name: "이서연", region: "서울 강남구", created_at: new Date(Date.now() - 5 * 864e5).toISOString() },
  { service_type: "partial", rating: 5, content: "변기만 교체하려 했는데 배수심·급수 위치까지 물어봐서 정확한 견적이 나왔어요.", author_name: "최지우", region: "대전 서구", created_at: new Date(Date.now() - 1 * 864e5).toISOString() },
  { service_type: "partial", rating: 4, content: "세면대 교체 자재 후보를 가격대별로 보여줘서 고르기 편했습니다.", author_name: "한가람", region: "부산 해운대구", created_at: new Date(Date.now() - 7 * 864e5).toISOString() },
  { service_type: "material_preview", rating: 5, content: "우리집 거실 바닥에 마루를 적용해본 미리보기가 실제랑 비슷해서 도움이 됐어요.", author_name: "오세훈", region: "대전 중구", created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
  { service_type: "material_preview", rating: 4, content: "ㄱ자 주방에 상판/도어 색을 바꿔보며 비교하니 선택이 쉬웠어요.", author_name: "강태리", region: "서울 마포구", created_at: new Date(Date.now() - 10 * 864e5).toISOString() },
];

function aggregate(rows: { service_type: string; rating: number }[]) {
  const byService: Record<string, { count: number; avg: number }> = {};
  for (const t of SERVICE_TYPES) byService[t] = { count: 0, avg: 0 };
  let sum = 0;
  for (const r of rows) {
    const b = byService[r.service_type];
    if (!b) continue;
    b.count += 1;
    b.avg += r.rating;
    sum += r.rating;
  }
  for (const t of SERVICE_TYPES) {
    const b = byService[t];
    b.avg = b.count ? Math.round((b.avg / b.count) * 10) / 10 : 0;
  }
  return {
    total: rows.length,
    avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
    byService,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const service = sp.get("service");
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit") ?? 30)));
  const supabase = createClient();

  try {
    const { data: allRows, error: aggErr } = await supabase
      .from("service_reviews")
      .select("service_type, rating")
      .eq("is_published", true);
    if (aggErr) throw aggErr;

    let listQuery = supabase
      .from("service_reviews")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (service && service !== "all" && SERVICE_TYPES.includes(service as ReviewServiceType)) {
      listQuery = listQuery.eq("service_type", service);
    }
    const { data: rows, error: listErr } = await listQuery;
    if (listErr) throw listErr;

    return NextResponse.json({
      reviews: (rows ?? []).map(mapDbReview),
      aggregate: aggregate((allRows ?? []) as { service_type: string; rating: number }[]),
      source: "db",
    });
  } catch (err) {
    console.error("[service-reviews:GET] fallback to mock:", err);
    let rows = MOCK;
    if (service && service !== "all") rows = MOCK.filter((m) => m.service_type === service);
    return NextResponse.json({
      reviews: rows.map((m, i) => mapDbReview({ ...m, id: `mock-${i}` })),
      aggregate: aggregate(MOCK.map((m) => ({ service_type: m.service_type, rating: m.rating }))),
      source: "mock",
    });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: {
    serviceType?: string;
    rating?: number;
    content?: string;
    title?: string;
    region?: string;
    authorName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const serviceType = body.serviceType;
  const rating = Number(body.rating);
  const content = (body.content ?? "").trim();
  if (!serviceType || !SERVICE_TYPES.includes(serviceType as ReviewServiceType)) {
    return NextResponse.json({ error: "서비스 종류가 올바르지 않습니다." }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "별점은 1~5 사이여야 합니다." }, { status: 400 });
  }
  if (content.length < 5) {
    return NextResponse.json({ error: "후기 내용을 5자 이상 입력해주세요." }, { status: 400 });
  }

  const authorName =
    (body.authorName ?? "").trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "익명";

  const { data, error } = await supabase
    .from("service_reviews")
    .insert({
      user_id: user.id,
      service_type: serviceType,
      rating,
      content,
      title: (body.title ?? "").trim() || null,
      region: (body.region ?? "").trim() || null,
      author_name: authorName,
      is_published: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[service-reviews:POST] insert error:", error);
    return NextResponse.json(
      { error: "후기 저장에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ review: mapDbReview(data), maskedName: maskName(authorName) });
}
