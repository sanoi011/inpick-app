import { createClient } from "@/lib/supabase/server";

export interface RegulationResult {
  law_name: string;
  article: string | null;
  body_text: string;
  tags: string[] | null;
}

// 법규 관련 질문 감지용 트리거 키워드 → tag 매핑
const REGULATION_TRIGGERS: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ["리모델링", "리모델"], tag: "리모델링" },
  { keywords: ["비내력벽", "비 내력벽"], tag: "비내력벽" },
  { keywords: ["내력벽"], tag: "내력벽" },
  { keywords: ["대수선"], tag: "대수선" },
  { keywords: ["구조변경", "구조 변경", "구조안전"], tag: "구조변경" },
  { keywords: ["방화", "방화구획", "방화벽"], tag: "방화" },
  { keywords: ["피난", "대피"], tag: "안전" },
  { keywords: ["공동주택", "아파트 법", "아파트법"], tag: "공동주택" },
];

function detectTags(query: string): string[] {
  const tags = new Set<string>();
  for (const { keywords, tag } of REGULATION_TRIGGERS) {
    if (keywords.some((k) => query.includes(k))) tags.add(tag);
  }
  return Array.from(tags);
}

export function hasRegulationTrigger(query: string): boolean {
  return detectTags(query).length > 0 || /법|조문|조항|시행령|시행규칙|건축법|주택법/.test(query);
}

/**
 * 질문에서 법규 태그 감지 후 building_regulations 조회.
 * 트리거 태그가 없으면 일반 body_text ILIKE 폴백.
 */
export async function searchRegulations(query: string, limit = 4): Promise<RegulationResult[]> {
  if (!hasRegulationTrigger(query)) return [];

  const supabase = createClient();
  const tags = detectTags(query);

  if (tags.length > 0) {
    const { data } = await supabase
      .from("building_regulations")
      .select("law_name, article, body_text, tags")
      .overlaps("tags", tags)
      .limit(limit);
    if (data && data.length > 0) return data as RegulationResult[];
  }

  // 폴백: 한글 2자 이상 키워드 ILIKE (법·조·령 등 제외)
  const stop = new Set(["법령", "조문", "조항", "시행령", "시행규칙"]);
  const kws = (query.match(/[가-힣]{2,}/g) || []).filter((k) => !stop.has(k)).slice(0, 2);
  for (const kw of kws) {
    const { data } = await supabase
      .from("building_regulations")
      .select("law_name, article, body_text, tags")
      .ilike("body_text", `%${kw}%`)
      .limit(limit);
    if (data && data.length > 0) return data as RegulationResult[];
  }

  return [];
}

export function formatRegulations(results: RegulationResult[]): string {
  if (results.length === 0) return "";
  return (
    "\n\n[참고 법규]\n" +
    results
      .map((r) => {
        const art = r.article ? ` ${r.article}` : "";
        const tag = r.tags && r.tags.length > 0 ? ` [${r.tags.join(",")}]` : "";
        return `${r.law_name}${art}${tag}\n${r.body_text.slice(0, 500)}`;
      })
      .join("\n---\n")
  );
}
