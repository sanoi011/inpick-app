import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embedding";

export interface KnowledgeResult {
  title: string;
  content: string;
  category: string;
  similarity?: number;
}

/**
 * 하이브리드 지식 검색
 * 1) Gemini 임베딩 → pgvector 시맨틱 검색
 * 2) 실패 시 → ILIKE 키워드 폴백
 */
export async function searchKnowledgeSemantic(
  query: string,
  limit = 5
): Promise<string> {
  // 시맨틱 검색 시도
  const semanticResults = await trySemanticSearch(query, limit);
  if (semanticResults.length > 0) {
    return formatResults(semanticResults);
  }

  // 폴백: 키워드 검색
  const keywordResults = await keywordSearch(query, limit);
  if (keywordResults.length > 0) {
    return formatResults(keywordResults);
  }

  return "";
}

async function trySemanticSearch(
  query: string,
  limit: number
): Promise<KnowledgeResult[]> {
  try {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    const supabase = createClient();
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: 0.3,
      match_count: limit,
    });

    if (error || !data) return [];

    return data.map((r: { title: string; content: string; category: string; similarity: number }) => ({
      title: r.title,
      content: r.content,
      category: r.category,
      similarity: r.similarity,
    }));
  } catch {
    return [];
  }
}

async function keywordSearch(
  query: string,
  limit: number
): Promise<KnowledgeResult[]> {
  try {
    const supabase = createClient();
    const keywords = query.match(/[가-힣]{2,}/g) || [];
    if (keywords.length === 0) return [];

    const searchTerms = keywords.slice(0, 3);
    const results: KnowledgeResult[] = [];

    for (const term of searchTerms) {
      const { data } = await supabase
        .from("construction_knowledge")
        .select("title, content, category")
        .ilike("content", `%${term}%`)
        .limit(2);
      if (data) results.push(...data);
    }

    // 중복 제거
    const unique = Array.from(
      new Map(results.map((r) => [r.content, r])).values()
    ).slice(0, limit);

    return unique;
  } catch {
    return [];
  }
}

function formatResults(results: KnowledgeResult[]): string {
  if (results.length === 0) return "";

  return (
    "\n\n[참고 건설 지식베이스]\n" +
    results
      .map((r) => {
        const sim = r.similarity ? ` (유사도 ${(r.similarity * 100).toFixed(0)}%)` : "";
        return `[${r.category}]${sim} ${r.title}\n${r.content.slice(0, 500)}`;
      })
      .join("\n---\n")
  );
}
