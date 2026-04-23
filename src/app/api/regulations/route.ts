import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Regulation = {
  id: number;
  source: string;
  law_name: string;
  article: string | null;
  paragraph: string | null;
  body_text: string;
  effective_date: string | null;
  amended_date: string | null;
  source_url: string | null;
  tags: string[] | null;
  created_at: string;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function sanitizeIlike(input: string) {
  return input.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
}

// GET /api/regulations
//   ?tag=리모델링           — tags 배열에 포함
//   ?law_name=건축법         — 법령명 정확 일치
//   ?q=비내력벽              — body_text 키워드 검색
//   ?limit=20&offset=0
//   ?facet=tags              — 태그별 카운트 집계 (results 대신 facets 반환)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const supabase = createClient();

  // Facet 모드: 태그별 카운트
  if (sp.get("facet") === "tags") {
    const { data, error } = await supabase
      .from("building_regulations")
      .select("tags")
      .not("tags", "is", null);

    if (error) {
      return NextResponse.json({ error: "태그 집계 실패", detail: error.message }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of data || []) {
      for (const t of (row.tags as string[] | null) || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const facets = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json({ facets });
  }

  const tag = sp.get("tag")?.trim();
  const lawName = sp.get("law_name")?.trim();
  const q = sp.get("q")?.trim();
  const limit = Math.min(parseInt(sp.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(sp.get("offset") || "0", 10) || 0, 0);

  let query = supabase
    .from("building_regulations")
    .select("id, source, law_name, article, paragraph, body_text, effective_date, amended_date, source_url, tags, created_at", { count: "exact" })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (tag) query = query.contains("tags", [tag]);
  if (lawName) query = query.eq("law_name", lawName);
  if (q) query = query.ilike("body_text", `%${sanitizeIlike(q)}%`);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "법규 조회 실패", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    total: count ?? 0,
    limit,
    offset,
    filters: { tag: tag || null, law_name: lawName || null, q: q || null },
    results: (data || []) as Regulation[],
  });
}
