/**
 * POST /api/inpick/vision-materials/analyze
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md
 *        Phase 4 — analyze API
 *
 * 흐름:
 *   1. Zod-like validation (수동)
 *   2. RunPod vision-materials worker 호출 (env 미설정 시 mock)
 *   3. surfaces[] → material_vision_observations 저장
 *   4. 각 observation별 product retrieval → rerank
 *   5. material_match_candidates 저장
 *   6. confidence gate → recommendation 생성
 *   7. material_match_decisions 저장 (auto_high_confidence만)
 *
 * 정책:
 *   - Gemini 절대 무사용
 *   - SKU hallucination 금지 — DB row만
 *   - signed URL or public URL 입력 (private storage 우회 X)
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAIProviderAllowed } from "@/lib/ai/model-registry";
import {
  callVisionMaterialsWorker,
} from "@/lib/vision-materials/worker-client";
import {
  insertObservations,
  insertCandidates,
  insertDecision,
  updateObservationMatchStatus,
  observationToRow,
  candidateToRow,
} from "@/lib/vision-materials/repository";
import { retrieveProductCandidates } from "@/lib/vision-materials/product-retrieval";
import { rerankCandidates } from "@/lib/vision-materials/product-reranker";
import { decideMaterialMatch } from "@/lib/vision-materials/confidence";
import { isCategoryCompatibleWithRoom } from "@/lib/vision-materials/category-map";
import type {
  VisionMaterialAnalyzeRequest,
  VisionMaterialAnalyzeResult,
  AnalyzedSurface,
} from "@/lib/vision-materials/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ─── 정책: Gemini 차단은 model-registry에서 enforce ───
// 이 라우트는 anthropic/openai/runpod만 사용

function validateRequest(body: unknown): VisionMaterialAnalyzeRequest | string {
  if (!body || typeof body !== "object") return "body 필요";
  const b = body as Record<string, unknown>;
  if (!b.projectId || typeof b.projectId !== "string") return "projectId 필요";
  if (!b.imageUrl || typeof b.imageUrl !== "string") return "imageUrl 필요";
  const sourceImageKind = (b.sourceImageKind as string) || "user_photo";
  if (!["user_photo", "ai_render", "floorplan", "reference"].includes(sourceImageKind)) {
    return "sourceImageKind invalid";
  }
  return {
    projectId: b.projectId,
    roomId: b.roomId as string | undefined,
    roomName: b.roomName as string | undefined,
    roomType: b.roomType as string | undefined,
    imageUrl: b.imageUrl,
    sourceImageRef: typeof b.sourceImageRef === "string" ? b.sourceImageRef : undefined,
    sourceImageKind: sourceImageKind as VisionMaterialAnalyzeRequest["sourceImageKind"],
    clickedPoint: b.clickedPoint as { x: number; y: number } | undefined,
    selectedBbox: b.selectedBbox as VisionMaterialAnalyzeRequest["selectedBbox"],
    floorplanGeometry: b.floorplanGeometry,
    budgetTier: b.budgetTier as VisionMaterialAnalyzeRequest["budgetTier"],
    styleTags: b.styleTags as string[] | undefined,
    targetSurfaceTypes: b.targetSurfaceTypes as VisionMaterialAnalyzeRequest["targetSurfaceTypes"],
    maxCandidates: b.maxCandidates as number | undefined,
  };
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  // 정책 검증 — anthropic 보조 검증 가능 (rerank VLM 옵션). gemini는 차단됨.
  try {
    assertAIProviderAllowed("anthropic");
  } catch {
    /* anthropic 미허용 정책이면 VLM rerank skip — 규칙만 사용 */
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }

  const validated = validateRequest(body);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }
  const req = validated;

  // 1. Worker 호출 (mock 또는 실제)
  const worker = await callVisionMaterialsWorker({
    imageUrl: req.imageUrl,
    clickedPoint: req.clickedPoint,
    selectedBbox: req.selectedBbox,
    targetSurfaceTypes: req.targetSurfaceTypes,
    roomType: req.roomType,
    styleTags: req.styleTags,
    maxSurfaces: 12,
  });

  if (worker.surfaces.length === 0) {
    return NextResponse.json<VisionMaterialAnalyzeResult>({
      status: "completed",
      observations: [],
      summary: {
        observationCount: 0,
        highConfidenceCount: 0,
        recommendedCount: 0,
        fallbackCount: 0,
        modelVersions: worker.modelVersions,
        elapsedMs: Date.now() - t0,
        analysisMode: worker.source,
      },
      hint: "표면 후보 없음 — 다른 영역을 클릭하거나 이미지 품질을 확인하세요",
    });
  }

  // 2. observation DB 저장
  const observationInputs = worker.surfaces.map((s) =>
    observationToRow(s, {
      projectId: req.projectId,
      roomId: req.roomId,
      sourceImageUrl: req.sourceImageRef || req.imageUrl,
      sourceImageKind: req.sourceImageKind,
    }),
  );
  const observationIds = await insertObservations(observationInputs);

  // 3. 각 observation별 후보 검색 + rerank + 매칭
  const analyzed: AnalyzedSurface[] = [];
  for (let i = 0; i < worker.surfaces.length; i++) {
    const obs = worker.surfaces[i];
    obs.id = observationIds[i];

    // 후보 검색
    const rawCandidates = await retrieveProductCandidates({
      observation: obs,
      roomType: req.roomType,
      roomName: req.roomName,
      budgetTier: req.budgetTier,
      styleTags: req.styleTags,
      maxCandidates: req.maxCandidates ?? 10,
    }).catch((error) => {
      // 한 표면의 카탈로그 검색 실패가 이미지 전체 분석을 실패시키지 않게 한다.
      console.warn(
        `[vision-materials/analyze] product retrieval failed for ${obs.surfaceType}:`,
        error instanceof Error ? error.message : String(error),
      );
      return [];
    });

    // Rerank
    const reranked = await rerankCandidates({
      observation: obs,
      candidates: rawCandidates,
      topN: 5,
      useVlmRerank: false, // Phase 5 minimal
    }).catch((error) => {
      console.warn(
        `[vision-materials/analyze] rerank failed for ${obs.surfaceType}:`,
        error instanceof Error ? error.message : String(error),
      );
      return [];
    });

    // candidates 저장 (DB)
    if (observationIds[i] && !observationIds[i].startsWith("mock-") && reranked.length > 0) {
      await insertCandidates(reranked.map((c) => candidateToRow(observationIds[i], c)));
    }

    // confidence gate
    const top1 = reranked[0];
    const compatible = top1
      ? isCategoryCompatibleWithRoom(
          top1.category || "",
          obs.surfaceType,
          req.roomType,
          req.roomName,
        )
      : true;

    const recommendation = decideMaterialMatch(reranked, {
      categoryCompatible: compatible,
    });

    // Launch-critical (2026-05-11): auto_high_confidence는 eval 통과 후만.
    // mock worker 응답이면 confirmed라도 절대 저장 X.
    const evalPassed = process.env.VISION_MATERIALS_EVAL_PASSED === "true";
    const isMockWorker = worker.source === "mock";
    if (
      recommendation.status === "confirmed" &&
      evalPassed &&
      !isMockWorker &&
      observationIds[i] &&
      !observationIds[i].startsWith("mock-")
    ) {
      await insertDecision({
        observationId: observationIds[i],
        selectedMaterialProductId: recommendation.selectedMaterialProductId,
        decisionType: "auto_high_confidence",
        confidence: recommendation.confidence,
      });
    } else if (recommendation.status === "confirmed" && (isMockWorker || !evalPassed)) {
      // confirmed 강등 — UI에서 confirmed로 표시되지 않도록 status를 recommended로 변경
      // (mock 또는 eval 미통과)
      recommendation.status = "recommended";
      recommendation.fallbackReason =
        recommendation.fallbackReason ||
        (isMockWorker ? "MOCK_WORKER_NOT_PRODUCTION_GRADE" : "VISION_MATERIALS_EVAL_NOT_PASSED");
    }

    await updateObservationMatchStatus(
      observationIds[i],
      recommendation.status === "confirmed"
        ? "confirmed"
        : recommendation.status === "recommended"
          ? "matched"
          : recommendation.status === "rejected"
            ? "rejected"
            : "fallback",
    );

    analyzed.push({
      observation: obs,
      candidates: reranked,
      recommendation,
    });
  }

  const summary = analyzed.reduce(
    (acc, a) => {
      if (a.recommendation.status === "confirmed") acc.highConfidenceCount++;
      else if (a.recommendation.status === "recommended") acc.recommendedCount++;
      else if (a.recommendation.status === "fallback") acc.fallbackCount++;
      return acc;
    },
    {
      observationCount: analyzed.length,
      highConfidenceCount: 0,
      recommendedCount: 0,
      fallbackCount: 0,
      modelVersions: worker.modelVersions,
      elapsedMs: Date.now() - t0,
      analysisMode: worker.source,
    },
  );

  return NextResponse.json<VisionMaterialAnalyzeResult>({
    status: "completed",
    observations: analyzed,
    summary,
  });
}
