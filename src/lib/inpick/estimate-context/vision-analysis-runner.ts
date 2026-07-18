/**
 * design_output 1건의 자재 정밀 분석(vision-materials/analyze) 실행 + 상태 갱신.
 *
 * design-outputs POST(생성 직후)와 reanalyze(멈춘 분석 재실행)에서 공용.
 * 어느 단계에서 실패해도 throw 하지 않음 — design_output 저장/응답 흐름을 절대 막지 않는다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DesignOutput, MaterialHint } from "./types";

export async function runVisionAnalysisForOutput(opts: {
  admin: SupabaseClient;
  output: DesignOutput;
  origin: string;
  cookie: string;
}): Promise<"done" | "failed"> {
  const { admin, output, origin, cookie } = opts;

  // Step 1: pending 마킹
  await admin
    .from("design_outputs")
    .update({ status: "analysis_pending" })
    .eq("id", output.id);

  try {
    // Step 2: vision-materials/analyze 호출 (서버-내부 호출, 인증 쿠키 그대로 전달)
    const targetSurfaceTypes = inferTargetSurfaceTypes(output);
    const analyzeRes = await fetch(`${origin}/api/inpick/vision-materials/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        projectId: output.projectId,
        roomId: output.targetId,
        roomName: output.targetName,
        imageUrl: output.imageUrl,
        sourceImageKind: "ai_render",
        targetSurfaceTypes,
        maxCandidates: 5,
      }),
    });

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text().catch(() => "");
      throw new Error(`analyze ${analyzeRes.status}: ${errText.slice(0, 200)}`);
    }

    const analyzeData = (await analyzeRes.json()) as {
      observations?: Array<{
        observation?: {
          id?: string;
          surfaceType?: string;
        };
        candidates?: Array<{
          materialProductId?: string;
          brand?: string;
          productName?: string;
          sku?: string;
          spec?: string;
          category?: string;
          unit?: string;
          unitPrice?: number;
          priceSource?: string;
          confidence?: number;
        }>;
        recommendation?: {
          status?: string;
          confidence?: number;
        };
      }>;
    };

    // Step 3: 결과 → MaterialHint 변환 (기존 prompt hint와 병합, vision 우선)
    const visionHints: MaterialHint[] = [];
    for (const surface of analyzeData.observations ?? []) {
      const top = surface.candidates?.[0];
      if (!top || !top.materialProductId) continue;
      const status = surface.recommendation?.status;
      if (status === "fallback" || status === "rejected") continue;
      visionHints.push({
        surfaceType: mapSurfaceTypeForHint(surface.observation?.surfaceType),
        materialCategory: top.category || surface.observation?.surfaceType || "unknown",
        materialProductId: top.materialProductId,
        materialNameKo: top.productName,
        brand: top.brand,
        sku: top.sku,
        spec: top.spec,
        unit: top.unit,
        unitPrice: top.unitPrice,
        priceSource: top.priceSource,
        observationId: surface.observation?.id,
        matchStatus: status === "confirmed" ? "confirmed" : "recommended",
        confidence: surface.recommendation?.confidence ?? top.confidence ?? 0.5,
        source: "vision_analysis",
        assumptions: status === "confirmed" ? ["vision 분석 confirmed"] : [],
      });
    }

    const seen = new Set<string>();
    const mergedHints: MaterialHint[] = [];
    for (const h of [...visionHints, ...(output.materialHints ?? [])]) {
      const key = h.surfaceType;
      if (seen.has(key)) continue;
      seen.add(key);
      mergedHints.push(h);
    }

    await admin
      .from("design_outputs")
      .update({
        status: "analysis_done",
        material_hints: mergedHints,
      })
      .eq("id", output.id);
    return "done";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[vision-analysis-runner] analyze failed for ${output.id}:`, msg);
    await admin
      .from("design_outputs")
      .update({
        status: "analysis_failed",
        analysis_error: msg.slice(0, 500),
      })
      .eq("id", output.id);
    return "failed";
  }
}

function inferTargetSurfaceTypes(output: DesignOutput): string[] {
  // surface_render는 좁게, room_render는 floor/wall/ceiling 기본,
  // commercial zone은 counter/signage 등 추가
  if (output.renderKind === "surface_render") return ["floor", "wall", "ceiling", "tile"];
  if (output.projectMode === "commercial") {
    return ["floor", "wall", "ceiling", "counter", "signage", "partition"];
  }
  return ["floor", "wall", "ceiling"];
}

function mapSurfaceTypeForHint(t?: string): MaterialHint["surfaceType"] {
  switch (t) {
    case "floor":
      return "floor";
    case "wall":
      return "wall";
    case "ceiling":
      return "ceiling";
    case "door":
      return "door";
    case "window":
      return "window";
    case "cabinet":
    case "countertop":
      return "counter";
    case "lighting":
      return "lighting";
    case "tile":
      return "wall"; // tile은 surface가 wall이거나 floor — 기본 wall
    default:
      return "unknown";
  }
}
