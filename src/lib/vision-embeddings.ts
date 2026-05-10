// VSMCS Stage 1+2 — Constrained-kNN Search 구현 (Patent B Detail D9)
// Supabase pgvector 검색 함수 (search_vision_embeddings) 호출 + 자체 reranking

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface VisionFilter {
  space?: string;
  style?: string;
  drawingType?: string;
  tradeCode?: string;
  hasPair?: boolean;
  minQuality?: "A" | "B";
  koreanTokens?: string[];
  category?: string;
}

export interface ConstraintScore {
  budgetMax?: number;     // 사용자 예산
  spaceM2?: number;       // 공간 면적 m²
  regulationCodes?: string[]; // 적합해야 할 법규 코드
}

export interface SearchResult {
  path: string;
  text: string;
  similarity: number;     // ANN 코사인 유사도 (0-1)
  reranked_score?: number; // 제약 만족 합산 점수 (0-1)
  space?: string;
  style?: string;
  korean_aesthetic_tokens?: string[];
  materials_simple?: string[];
  drawing_type?: string;
  category?: string;
}

/** Gemini text-embedding-001 으로 텍스트 임베딩 */
export async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) throw new Error(`embedText failed: ${res.status}`);
  const data = await res.json();
  return data.embedding.values;
}

/** Stage 1: ANN 검색 (Top-N 후보 추출) */
export async function annSearch(
  queryEmbedding: number[],
  filter: VisionFilter = {},
  topN: number = 1000
): Promise<SearchResult[]> {
  const { data, error } = await sb.rpc("search_vision_embeddings", {
    query_embedding: queryEmbedding,
    filter_space: filter.space ?? null,
    filter_style: filter.style ?? null,
    filter_drawing_type: filter.drawingType ?? null,
    filter_trade_code: filter.tradeCode ?? null,
    filter_has_pair: filter.hasPair ?? null,
    filter_min_quality: filter.minQuality ?? null,
    filter_korean_tokens: filter.koreanTokens ?? null,
    filter_category: filter.category ?? null,
    match_count: topN,
    ef_search: 64,
  });
  if (error) throw new Error(`annSearch RPC failed: ${error.message}`);
  return data as SearchResult[];
}

/** Stage 2: Constrained Reranking (Patent B Detail D9)
 *  의미 유사도 + 예산 fit + 공간 fit + 법규 준수도 + 재고 가용성의 가중 합산.
 *  현재 단가/재고 데이터 미구축이라 weight 만 정의, 실값은 default 0.
 */
export function constrainedRerank(
  candidates: SearchResult[],
  constraints: ConstraintScore = {},
  weights = { sim: 0.6, budget: 0.2, space: 0.1, regulation: 0.07, stock: 0.03 }
): SearchResult[] {
  return candidates
    .map((c) => {
      const sim = c.similarity;
      // budget_fit / space_fit / regulation / stock 은 라벨에 직접 없으니
      // 추정 신호로 점수화 (자재 단가 lookup 연동은 P4 에서 본 시행)
      const budgetFit = constraints.budgetMax ? estimateBudgetFit(c, constraints.budgetMax) : 0.5;
      const spaceFit = constraints.spaceM2 ? estimateSpaceFit(c, constraints.spaceM2) : 0.5;
      const regulation = constraints.regulationCodes?.length ? 0.7 : 0.5;
      const stock = 0.5; // P4 단가 DB 연동 후 재고 신호 반영

      const score =
        weights.sim * sim +
        weights.budget * budgetFit +
        weights.space * spaceFit +
        weights.regulation * regulation -
        (1 - stock) * weights.stock;

      return { ...c, reranked_score: Math.max(0, Math.min(1, score)) };
    })
    .sort((a, b) => (b.reranked_score ?? 0) - (a.reranked_score ?? 0));
}

function estimateBudgetFit(c: SearchResult, budgetMax: number): number {
  // 자재 등급/카테고리에서 예산 적합도 추정
  // 임시: korean_traditional 은 평균 ₩+30%, modern minimal 은 평균값
  if (c.style?.includes("traditional") || c.style?.includes("luxury")) return 0.3;
  if (c.style?.includes("minimal") || c.style?.includes("scandinavian")) return 0.7;
  return 0.5;
}

function estimateSpaceFit(c: SearchResult, spaceM2: number): number {
  // 공간 크기 vs 자재 적합도 추정 (대형 자재는 작은 공간에 부적합 등)
  if (spaceM2 < 30 && c.style === "luxury") return 0.3;
  if (spaceM2 > 100 && c.style === "minimal") return 0.6;
  return 0.5;
}

/** 통합 검색 함수: ANN + Reranking */
export async function searchByQuery(
  queryText: string,
  filter: VisionFilter = {},
  constraints: ConstraintScore = {},
  topN: number = 1000,
  finalK: number = 10
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(queryText);
  const candidates = await annSearch(queryEmbedding, filter, topN);
  const reranked = constrainedRerank(candidates, constraints);
  return reranked.slice(0, finalK);
}
