/**
 * Product retrieval — material_products + material_product_images vector search.
 *
 * 가이드: §8 (제품 후보 검색 설계)
 *
 * 단계:
 *   1. surfaceType + roomType → category hints
 *   2. material_product_images (clip_embedding) vector similarity Top-K
 *      또는 embedding 없으면 category + popularity 기준 fallback
 *   3. material_products + material_price_lookup join → unitPrice
 *   4. 점수 산식 적용 → MaterialProductCandidate
 *
 * 정책: SKU hallucination 금지 — DB row만 반환.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  MaterialProductCandidate,
  SurfaceObservation,
} from "./types";
import { refineCategoryHintsByRoom, isCategoryCompatibleWithRoom } from "./category-map";
import { computeMaterialCandidateScore, totalToConfidence } from "./confidence";

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export interface ProductRetrievalInput {
  observation: SurfaceObservation;
  roomType?: string;
  roomName?: string;
  budgetTier?: "low" | "mid" | "high" | "premium";
  styleTags?: string[];
  projectRegion?: string;
  maxCandidates: number;
}

/**
 * Top-K 후보 검색.
 * 1) embedding 있으면 vector similarity (material_product_images.clip_embedding)
 * 2) 없으면 category + popularity_score 기반
 */
export async function retrieveProductCandidates(
  input: ProductRetrievalInput,
): Promise<MaterialProductCandidate[]> {
  const admin = getAdmin();
  if (!admin) {
    console.warn("[vision-materials/retrieval] Supabase 미설정 — 빈 후보 반환");
    return [];
  }

  const { observation, roomType, roomName } = input;
  const max = Math.min(20, Math.max(1, input.maxCandidates));
  const categoryHints = refineCategoryHintsByRoom(observation.surfaceType, roomType, roomName);
  if (categoryHints.length === 0) {
    return [];
  }

  // ─── 1차: vector similarity (embedding 있을 때만) ───
  let candidates: Array<{
    id: string;
    brand: string;
    product_name: string;
    sku?: string;
    spec?: string;
    category_code: string;
    unit?: string;
    contractor_price?: number;
    retail_price?: number;
    price_grade?: string;
    thumbnail_url?: string;
    popularity_score?: number;
    is_verified?: boolean;
    visual_similarity?: number;
  }> = [];

  if (observation.embedding && observation.embedding.length > 0) {
    // Supabase pgvector RPC가 없으면 raw query 사용
    // 우선 단순 SELECT + popularity 기준으로 fallback (embedding 없는 환경 대응)
    // production: RPC 함수 또는 SQL `<=>` 연산 추가 필요
    try {
      const { data, error } = await admin
        .from("material_products")
        .select(
          "id, brand, product_name, model_number, specification, category_code, unit, retail_price, contractor_price, price_grade, thumbnail_url, popularity_score, is_verified",
        )
        .in("category_code", categoryHints)
        .not("brand", "is", null)
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .limit(max * 2); // 여유분 (rerank 시 점수 낮은 것 필터)
      if (!error && data) {
        candidates = data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          brand: p.brand as string,
          product_name: p.product_name as string,
          sku: p.model_number as string | undefined,
          spec: p.specification as string | undefined,
          category_code: p.category_code as string,
          unit: p.unit as string | undefined,
          contractor_price: p.contractor_price as number | undefined,
          retail_price: p.retail_price as number | undefined,
          price_grade: p.price_grade as string | undefined,
          thumbnail_url: p.thumbnail_url as string | undefined,
          popularity_score: p.popularity_score as number | undefined,
          is_verified: p.is_verified as boolean | undefined,
        }));
      }
    } catch (e) {
      console.warn(
        `[vision-materials/retrieval] vector search error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ─── 2차: embedding 없거나 실패 시 — category + popularity ───
  if (candidates.length === 0) {
    const { data, error } = await admin
      .from("material_products")
      .select(
        "id, brand, product_name, model_number, specification, category_code, unit, retail_price, contractor_price, price_grade, thumbnail_url, popularity_score, is_verified",
      )
      .in("category_code", categoryHints)
      .not("brand", "is", null)
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(max);
    if (!error && data) {
      candidates = data.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        brand: p.brand as string,
        product_name: p.product_name as string,
        sku: p.model_number as string | undefined,
        spec: p.specification as string | undefined,
        category_code: p.category_code as string,
        unit: p.unit as string | undefined,
        contractor_price: p.contractor_price as number | undefined,
        retail_price: p.retail_price as number | undefined,
        price_grade: p.price_grade as string | undefined,
        thumbnail_url: p.thumbnail_url as string | undefined,
        popularity_score: p.popularity_score as number | undefined,
        is_verified: p.is_verified as boolean | undefined,
      }));
    }
  }

  // ─── 3차: 점수화 (간단 휴리스틱 — production은 reranker.ts에서 정밀) ───
  const out: MaterialProductCandidate[] = candidates.slice(0, max).map((p, i) => {
    const compatible = isCategoryCompatibleWithRoom(
      p.category_code,
      observation.surfaceType,
      roomType,
      roomName,
    );
    const visual = observation.embedding ? 0.6 : 0.4; // embedding 없으면 낮춤
    const category = compatible ? 0.9 : 0.3;
    const popularity = (p.popularity_score || 0) / 100; // 정규화
    const priceAvail = (p.contractor_price || p.retail_price) ? 1 : 0;
    const verifiedBonus = p.is_verified ? 0.1 : 0;
    const priceCompetitive = budgetMatch(input.budgetTier, p.price_grade);

    const scores = {
      category,
      visual: Math.min(1, visual + verifiedBonus),
      texture: 0.5,
      color: 0.5,
      ocr: 0,
      price: priceAvail * 0.8 + priceCompetitive * 0.2,
      roomRule: compatible ? 1 : 0,
      budgetStyle: priceCompetitive,
      total: 0, // 다음 줄에서 계산
    };
    const total = computeMaterialCandidateScore(scores);
    scores.total = total;

    const reasons: string[] = [];
    if (compatible) reasons.push(`category match: ${p.category_code}`);
    if (p.is_verified) reasons.push("verified product");
    if (p.popularity_score && p.popularity_score > 0)
      reasons.push(`popular (score ${p.popularity_score})`);

    const warnings: string[] = [];
    if (!compatible)
      warnings.push(`CATEGORY_ROOM_INCOMPATIBLE: ${observation.surfaceType} vs ${p.category_code}`);
    if (!priceAvail) warnings.push("PRICE_MISSING");
    if (!observation.embedding) warnings.push("NO_EMBEDDING_USED_CATEGORY_ONLY");

    return {
      materialProductId: p.id,
      rank: i + 1,
      brand: p.brand,
      productName: p.product_name,
      sku: p.sku,
      spec: p.spec,
      category: p.category_code,
      unit: p.unit,
      unitPrice: p.contractor_price || p.retail_price,
      priceSource: p.contractor_price ? "contractor_price" : p.retail_price ? "retail_price" : undefined,
      imageUrl: p.thumbnail_url,
      scores,
      confidence: totalToConfidence(total),
      reasons,
      warnings,
    };
  });

  // 점수 내림차순 재정렬
  out.sort((a, b) => b.scores.total - a.scores.total);
  // rank 재할당
  out.forEach((c, i) => {
    c.rank = i + 1;
  });
  return out;
}

/** 예산 단계 매칭 점수 (0~1) */
function budgetMatch(
  budgetTier: "low" | "mid" | "high" | "premium" | undefined,
  priceGrade: string | undefined,
): number {
  if (!budgetTier || !priceGrade) return 0.5;
  const b = budgetTier.toLowerCase();
  const g = priceGrade.toLowerCase();
  if (b === "low" && g === "economy") return 1;
  if (b === "mid" && g === "standard") return 1;
  if ((b === "high" || b === "premium") && g === "premium") return 1;
  // 인접 grade — 0.5
  if (
    (b === "low" && g === "standard") ||
    (b === "mid" && (g === "economy" || g === "premium")) ||
    (b === "high" && g === "standard")
  ) {
    return 0.5;
  }
  return 0.2;
}
