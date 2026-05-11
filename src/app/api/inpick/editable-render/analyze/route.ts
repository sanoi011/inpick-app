/**
 * POST /api/inpick/editable-render/analyze
 *
 * 1차 AI 렌더 이미지 → 부위별 EditableRenderLayer 분해.
 * 가이드: §6-2
 *
 * Flow:
 *   1. RunPod vision-materials worker(mode=layer_analyze) 호출 — 또는 geometry prior fallback
 *   2. layers를 DB에 저장
 *   3. editableRenderId 반환
 */
import { NextRequest, NextResponse } from "next/server";
import { insertEditableRender, insertLayers } from "@/lib/inpick/editable-render/repository";
import {
  makeLayerId,
  surfaceTypeLabelKo,
  type EditableRenderLayer,
  type SurfaceType,
} from "@/lib/inpick/editable-render/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface BodyInput {
  projectId: string;
  renderId?: string;
  imageUrl: string;
  projectMode: "residential" | "commercial";
  targetId: string;
  targetNameKo?: string;
  renderSpec?: Record<string, unknown>;
  targetSurfaceTypes?: SurfaceType[];
}

export async function POST(req: NextRequest) {
  let body: BodyInput;
  try {
    body = (await req.json()) as BodyInput;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
  }
  if (!body.projectId || !body.imageUrl || !body.targetId) {
    return NextResponse.json({ error: "projectId/imageUrl/targetId 필수" }, { status: 400 });
  }

  // 1. editable_render 생성
  const editableRenderId = await insertEditableRender({
    projectId: body.projectId,
    renderId: body.renderId,
    targetId: body.targetId,
    targetNameKo: body.targetNameKo,
    projectMode: body.projectMode,
    imageUrl: body.imageUrl,
    renderSpec: body.renderSpec,
  });

  if (!editableRenderId) {
    return NextResponse.json(
      { error: "EDITABLE_RENDER_INSERT_FAILED", hint: "Supabase 또는 migration 미적용" },
      { status: 500 },
    );
  }

  // 2. RunPod worker 호출 (mode=layer_analyze) — 없으면 geometry prior 기반 layer 생성
  const targets: SurfaceType[] = body.targetSurfaceTypes || [
    "floor",
    "wall",
    "ceiling",
    "window",
    "door",
  ];

  let layers: EditableRenderLayer[] = [];
  const runpodEndpoint = process.env.RUNPOD_VISION_MATERIALS_ENDPOINT;
  if (runpodEndpoint && process.env.RUNPOD_API_KEY) {
    layers = await callRunpodLayerAnalyze({
      imageUrl: body.imageUrl,
      projectId: body.projectId,
      targetId: body.targetId,
      targetSurfaceTypes: targets,
      renderSpec: body.renderSpec,
      endpoint: runpodEndpoint,
      apiKey: process.env.RUNPOD_API_KEY,
    });
  }

  // fallback — geometry prior 기반 (정확도 낮지만 UI 동작)
  if (layers.length === 0) {
    layers = generateGeometryPriorLayers({
      projectId: body.projectId,
      targetId: body.targetId,
      projectMode: body.projectMode,
      targets,
    });
  }

  // 3. layers DB 저장
  const ids = await insertLayers(editableRenderId, body.projectId, layers);
  // layer.id 갱신 (DB에서 생성된 UUID로)
  const enrichedLayers = layers.map((l, i) => ({ ...l, id: ids[i] || l.id }));

  return NextResponse.json({
    editableRenderId,
    imageUrl: body.imageUrl,
    layers: enrichedLayers,
    summary: {
      layerCount: enrichedLayers.length,
      highConfidenceCount: enrichedLayers.filter((l) => l.confidence >= 0.7).length,
      lowConfidenceCount: enrichedLayers.filter((l) => l.confidence < 0.7).length,
      warnings: enrichedLayers.flatMap((l) => l.warnings || []),
    },
  });
}

async function callRunpodLayerAnalyze(input: {
  imageUrl: string;
  projectId: string;
  targetId: string;
  targetSurfaceTypes: SurfaceType[];
  renderSpec?: Record<string, unknown>;
  endpoint: string;
  apiKey: string;
}): Promise<EditableRenderLayer[]> {
  try {
    const res = await fetch(`${input.endpoint}/runsync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        input: {
          mode: "layer_analyze",
          image_url: input.imageUrl,
          target_surface_types: input.targetSurfaceTypes,
          render_spec: input.renderSpec,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { output?: { layers?: Array<Record<string, unknown>> } };
    const rawLayers = data.output?.layers || [];
    return rawLayers.map((r, i) => mapRunpodLayer(r, input.projectId, input.targetId, i));
  } catch (e) {
    console.warn(
      `[editable-render/analyze] runpod fail: ${e instanceof Error ? e.message : String(e)}`,
    );
    return [];
  }
}

function mapRunpodLayer(
  r: Record<string, unknown>,
  projectId: string,
  targetId: string,
  i: number,
): EditableRenderLayer {
  const surfaceType = (r.surface_type as SurfaceType) || "unknown";
  const plane = r.plane as EditableRenderLayer["plane"];
  return {
    id: makeLayerId(surfaceType, plane, i),
    projectId,
    targetId,
    surfaceType,
    labelKo: (r.label_ko as string) || surfaceTypeLabelKo(surfaceType),
    labelEn: (r.label_en as string) || surfaceType,
    instanceIndex: i,
    polygon: (r.polygon as Array<{ x: number; y: number }>) || [],
    bbox: (r.bbox as { x: number; y: number; width: number; height: number }) || {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    maskUrl: r.mask_url as string | undefined,
    zIndex: (r.z_index as number) || 0,
    plane,
    confidence: (r.confidence as number) || 0.5,
    source: "merged",
    warnings: [],
  };
}

/**
 * Geometry prior fallback — 대략적인 floor/wall/ceiling 위치를 정규화 좌표로.
 * Runpod 미사용 + AI worker 없는 환경에서도 UI 동작 보장.
 */
function generateGeometryPriorLayers(input: {
  projectId: string;
  targetId: string;
  projectMode: "residential" | "commercial";
  targets: SurfaceType[];
}): EditableRenderLayer[] {
  const out: EditableRenderLayer[] = [];
  let i = 1;

  // floor — 하단 1/3
  if (input.targets.includes("floor")) {
    out.push({
      id: makeLayerId("floor", "floor", i++),
      projectId: input.projectId,
      targetId: input.targetId,
      surfaceType: "floor",
      labelKo: "바닥",
      labelEn: "floor",
      instanceIndex: 1,
      polygon: [
        { x: 0.05, y: 0.65 },
        { x: 0.95, y: 0.65 },
        { x: 1.0, y: 1.0 },
        { x: 0, y: 1.0 },
      ],
      bbox: { x: 0, y: 0.65, width: 1, height: 0.35 },
      zIndex: 1,
      plane: "floor",
      confidence: 0.45,
      source: "geometry_prior",
      warnings: ["geometry_prior fallback — RunPod 활성 시 정확도 ↑"],
    });
  }

  // walls — 좌/우/정면 3개
  if (input.targets.includes("wall")) {
    // back wall — 중앙 상단
    out.push({
      id: makeLayerId("wall", "back_wall", i++),
      projectId: input.projectId,
      targetId: input.targetId,
      surfaceType: "wall",
      labelKo: "정면벽",
      labelEn: "back wall",
      instanceIndex: 1,
      polygon: [
        { x: 0.2, y: 0.15 },
        { x: 0.8, y: 0.15 },
        { x: 0.8, y: 0.65 },
        { x: 0.2, y: 0.65 },
      ],
      bbox: { x: 0.2, y: 0.15, width: 0.6, height: 0.5 },
      zIndex: 0,
      plane: "back_wall",
      confidence: 0.4,
      source: "geometry_prior",
      warnings: ["geometry_prior fallback"],
    });
    // left wall
    out.push({
      id: makeLayerId("wall", "left_wall", i++),
      projectId: input.projectId,
      targetId: input.targetId,
      surfaceType: "wall",
      labelKo: "좌측벽",
      labelEn: "left wall",
      instanceIndex: 2,
      polygon: [
        { x: 0, y: 0.1 },
        { x: 0.2, y: 0.15 },
        { x: 0.2, y: 0.65 },
        { x: 0, y: 0.95 },
      ],
      bbox: { x: 0, y: 0.1, width: 0.2, height: 0.85 },
      zIndex: 0,
      plane: "left_wall",
      confidence: 0.4,
      source: "geometry_prior",
      warnings: [],
    });
    // right wall
    out.push({
      id: makeLayerId("wall", "right_wall", i++),
      projectId: input.projectId,
      targetId: input.targetId,
      surfaceType: "wall",
      labelKo: "우측벽",
      labelEn: "right wall",
      instanceIndex: 3,
      polygon: [
        { x: 0.8, y: 0.15 },
        { x: 1.0, y: 0.1 },
        { x: 1.0, y: 0.95 },
        { x: 0.8, y: 0.65 },
      ],
      bbox: { x: 0.8, y: 0.1, width: 0.2, height: 0.85 },
      zIndex: 0,
      plane: "right_wall",
      confidence: 0.4,
      source: "geometry_prior",
      warnings: [],
    });
  }

  // ceiling
  if (input.targets.includes("ceiling")) {
    out.push({
      id: makeLayerId("ceiling", "ceiling", i++),
      projectId: input.projectId,
      targetId: input.targetId,
      surfaceType: "ceiling",
      labelKo: "천장",
      labelEn: "ceiling",
      instanceIndex: 1,
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.8, y: 0.15 },
        { x: 0.2, y: 0.15 },
      ],
      bbox: { x: 0, y: 0, width: 1, height: 0.15 },
      zIndex: 0,
      plane: "ceiling",
      confidence: 0.45,
      source: "geometry_prior",
      warnings: [],
    });
  }

  return out;
}
