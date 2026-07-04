/**
 * GET /api/partial-install/contractors?region=&keyword=
 *
 * 네이버 지역검색 API 기반 실제 시공업체 검색 (부분 자재·시공 서비스).
 * - 지역검색은 쿼리당 최대 5건 → 검색어 변형 4개를 병렬 호출해 합치고 중복 제거
 * - 각 업체는 네이버 지도 검색 링크로 연결 (전화번호 있으면 함께 반환)
 * - 키 미설정/오류 시 빈 배열 (가짜 데이터 반환 금지 — 실서비스 원칙)
 */
import { NextRequest, NextResponse } from "next/server";
import type { LocalContractor } from "@/types/partial-install";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();

async function fetchLocal(
  id: string,
  secret: string,
  query: string,
  sort: "comment" | "random",
): Promise<Array<Record<string, string>>> {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
      query,
    )}&display=5&sort=${sort}`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!res.ok) throw new Error(`local api ${res.status}`);
    const data = await res.json();
    return (data.items ?? []) as Array<Record<string, string>>;
  } catch (err) {
    console.warn(`[partial-contractors] query "${query}" 실패:`, err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const region = (req.nextUrl.searchParams.get("region") ?? "").trim();
  const keyword = (req.nextUrl.searchParams.get("keyword") ?? "인테리어").trim();
  if (!region) {
    return NextResponse.json({ error: "MISSING_REGION" }, { status: 400 });
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ contractors: [], source: "no_api_key" });
  }

  // 검색어 변형 — 공종 특화 2개(리뷰순) + 일반 인테리어 2개
  const queries: Array<{ q: string; sort: "comment" | "random" }> = [
    { q: `${region} ${keyword} 시공`, sort: "comment" },
    { q: `${region} ${keyword} 전문`, sort: "comment" },
    { q: `${region} 인테리어 시공`, sort: "comment" },
    { q: `${region} 종합 인테리어`, sort: "random" },
  ];

  const results = await Promise.all(
    queries.map(({ q, sort }) => fetchLocal(clientId, clientSecret, q, sort)),
  );

  const seen = new Set<string>();
  const contractors: LocalContractor[] = [];
  for (const items of results) {
    for (const it of items) {
      const name = stripTags(it.title ?? "");
      if (!name) continue;
      const address = it.roadAddress || it.address || "";
      const dedupeKey = `${name}::${address}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      contractors.push({
        id: dedupeKey,
        name,
        category: (it.category ?? "").split(">").pop()?.trim() || "인테리어",
        address,
        telephone: it.telephone || null,
        homepage: it.link || null,
        naverMapUrl: `https://map.naver.com/p/search/${encodeURIComponent(`${name} ${region}`)}`,
      });
    }
  }

  return NextResponse.json({
    contractors: contractors.slice(0, 12),
    source: "naver_local",
    region,
    keyword,
  });
}
