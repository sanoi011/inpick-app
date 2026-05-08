// Patent B VSMCS 통합 검색 API
// POST /api/material-search
// Body: {
//   query?: string,                  // 자연어 (선택)
//   image?: string (base64),          // 시각적 입력 (선택, query 와 함께 가능)
//   imageMime?: "image/jpeg",
//   filter?: { space, style, drawingType, ... },
//   constraints?: { budgetMax, spaceM2, regulationCodes },
//   topN?: 1000,                      // ANN 후보 수
//   finalK?: 10                       // 최종 반환 수
// }

import { NextRequest, NextResponse } from "next/server";
import { fusedQueryEmbedding } from "@/lib/multi-modal-fusion";
import { annSearch, constrainedRerank, type VisionFilter, type ConstraintScore } from "@/lib/vision-embeddings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.query as string | undefined;
    const image = body.image as string | undefined;
    const imageMime = body.imageMime || "image/jpeg";

    if (!text && !image) {
      return NextResponse.json({ error: "query 또는 image 중 하나 이상 필요" }, { status: 400 });
    }

    const filter: VisionFilter = body.filter || {};
    const constraints: ConstraintScore = body.constraints || {};
    const topN = Math.min(Number(body.topN) || 1000, 5000);
    const finalK = Math.min(Number(body.finalK) || 10, 100);

    const t0 = Date.now();

    // Stage 1: Multi-Modal Query Fusion (D7 + D8)
    const { embedding, meta } = await fusedQueryEmbedding(text, image, imageMime);
    const tFusion = Date.now() - t0;

    // Stage 2: ANN Search
    const tAnn0 = Date.now();
    const candidates = await annSearch(embedding, filter, topN);
    const tAnn = Date.now() - tAnn0;

    // Stage 3: Constrained Reranking (D9)
    const tRerank0 = Date.now();
    const reranked = constrainedRerank(candidates, constraints);
    const tRerank = Date.now() - tRerank0;

    return NextResponse.json({
      results: reranked.slice(0, finalK),
      meta: {
        ...meta,
        topN_candidates: candidates.length,
        timing_ms: {
          fusion: tFusion,
          ann: tAnn,
          rerank: tRerank,
          total: Date.now() - t0,
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET 으로도 간단 검색 (이미지 없이 텍스트만)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });

  const filter: VisionFilter = {
    space: sp.get("space") || undefined,
    style: sp.get("style") || undefined,
    drawingType: sp.get("drawing_type") || undefined,
    tradeCode: sp.get("trade") || undefined,
    minQuality: (sp.get("min_quality") as "A" | "B" | undefined) || undefined,
    category: sp.get("category") || undefined,
  };
  const constraints: ConstraintScore = {
    budgetMax: sp.get("budget_max") ? Number(sp.get("budget_max")) : undefined,
    spaceM2: sp.get("space_m2") ? Number(sp.get("space_m2")) : undefined,
  };
  const finalK = Math.min(Number(sp.get("k")) || 10, 100);

  try {
    const t0 = Date.now();
    const { embedding, meta } = await fusedQueryEmbedding(q);
    const candidates = await annSearch(embedding, filter, 1000);
    const reranked = constrainedRerank(candidates, constraints);

    return NextResponse.json({
      results: reranked.slice(0, finalK),
      meta: { ...meta, topN_candidates: candidates.length, total_ms: Date.now() - t0 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
