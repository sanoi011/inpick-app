/**
 * RunPod vision-materials worker 클라이언트.
 *
 * 가이드: §7
 *
 * 정책:
 *   - RUNPOD_VISION_MATERIALS_ENDPOINT 미설정 시 mock 모드 (고정 응답)
 *   - production은 sync 또는 async 둘 다 지원 (RunPod /run /runsync)
 *   - 결과는 SurfaceObservation[] 형식으로 정규화하여 반환
 */

import type { SurfaceObservation, SurfaceType } from "./types";

export interface WorkerInput {
  imageUrl: string;
  clickedPoint?: { x: number; y: number };
  selectedBbox?: { x: number; y: number; width: number; height: number };
  targetSurfaceTypes?: SurfaceType[];
  roomType?: string;
  styleTags?: string[];
  maxSurfaces?: number;
}

export interface WorkerOutput {
  surfaces: SurfaceObservation[];
  modelVersions: Record<string, string>;
  elapsedMs: number;
  source: "real" | "mock";
}

/**
 * RunPod vision-materials worker 호출.
 * env 미설정 시 mock 응답.
 */
export async function callVisionMaterialsWorker(
  input: WorkerInput,
): Promise<WorkerOutput> {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_VISION_MATERIALS_ENDPOINT;
  if (!apiKey || !endpoint) {
    return mockWorkerResponse(input);
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${endpoint}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          image_url: input.imageUrl,
          clicked_point: input.clickedPoint,
          selected_bbox: input.selectedBbox,
          target_surface_types: input.targetSurfaceTypes,
          room_type: input.roomType,
          style_tags: input.styleTags,
          max_surfaces: input.maxSurfaces ?? 12,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn(`[vision-materials/worker] HTTP ${res.status} — fallback mock`);
      return mockWorkerResponse(input);
    }
    const data = (await res.json()) as {
      output?: {
        surfaces?: Array<Record<string, unknown>>;
        model_versions?: Record<string, string>;
        elapsed_ms?: number;
      };
    };
    const surfaces = ((data.output?.surfaces || []) as Array<Record<string, unknown>>).map(
      mapWorkerSurface,
    );
    return {
      surfaces,
      modelVersions: data.output?.model_versions || {},
      elapsedMs: data.output?.elapsed_ms || Date.now() - t0,
      source: "real",
    };
  } catch (e) {
    console.warn(
      `[vision-materials/worker] error: ${e instanceof Error ? e.message : String(e)} — fallback mock`,
    );
    return mockWorkerResponse(input);
  }
}

/** Worker raw 응답 → SurfaceObservation 변환 */
function mapWorkerSurface(s: Record<string, unknown>): SurfaceObservation {
  const bbox = (s.bbox as Record<string, number>) || { x: 0, y: 0, width: 0, height: 0 };
  return {
    surfaceType: (s.surface_type as SurfaceType) || "unknown",
    bbox: {
      x: bbox.x || 0,
      y: bbox.y || 0,
      width: bbox.width || 0,
      height: bbox.height || 0,
    },
    maskUrl: s.mask_url as string | undefined,
    cropUrl: s.crop_url as string | undefined,
    areaRatio: s.area_ratio as number | undefined,
    dominantColors: s.dominant_colors as { hex: string; ratio: number }[] | undefined,
    textureFeatures: s.texture_features as Record<string, unknown> | undefined,
    ocrText: s.ocr_text as string | undefined,
    coarseLabels: (s.coarse_labels as { label: string; confidence: number }[]) || [],
    embedding: s.clip_embedding as number[] | undefined,
    confidence: (s.confidence as number) || 0.5,
  };
}

/**
 * Mock worker 응답.
 * RunPod 없거나 dev 환경 — 고정된 1~3개 surface (이미지 면적 기준).
 */
function mockWorkerResponse(input: WorkerInput): WorkerOutput {
  const surfaces: SurfaceObservation[] = [];
  const targets = input.targetSurfaceTypes || ["floor", "wall", "ceiling"];

  // Mock: 클릭점 있으면 단일 surface, 없으면 floor+wall+ceiling 3개
  if (input.clickedPoint) {
    const surfaceType: SurfaceType = targets[0] || "floor";
    surfaces.push({
      surfaceType,
      bbox: {
        x: Math.max(0, input.clickedPoint.x - 200),
        y: Math.max(0, input.clickedPoint.y - 200),
        width: 400,
        height: 400,
      },
      areaRatio: 0.25,
      dominantColors: mockColorsForSurface(surfaceType),
      coarseLabels: mockLabelsForSurface(surfaceType),
      confidence: 0.65,
    });
  } else {
    for (const surfaceType of targets.slice(0, 3)) {
      surfaces.push({
        surfaceType,
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        areaRatio: 1 / targets.length,
        dominantColors: mockColorsForSurface(surfaceType),
        coarseLabels: mockLabelsForSurface(surfaceType),
        confidence: 0.55,
      });
    }
  }

  return {
    surfaces,
    modelVersions: {
      detector: "mock-grounding-dino",
      segmenter: "mock-sam2",
      embedding: "mock-openclip",
      ocr: "mock-easyocr",
    },
    elapsedMs: 50,
    source: "mock",
  };
}

function mockColorsForSurface(t: SurfaceType): { hex: string; ratio: number }[] {
  const palette: Record<string, { hex: string; ratio: number }[]> = {
    floor: [{ hex: "#B98F67", ratio: 0.6 }, { hex: "#8B6342", ratio: 0.3 }],
    wall: [{ hex: "#F5F0E8", ratio: 0.7 }, { hex: "#E8E0D0", ratio: 0.2 }],
    ceiling: [{ hex: "#FFFFFF", ratio: 0.85 }],
    tile: [{ hex: "#D8D2C8", ratio: 0.6 }],
    cabinet: [{ hex: "#5A4A3D", ratio: 0.5 }],
    countertop: [{ hex: "#1A1A1A", ratio: 0.7 }],
    sanitary: [{ hex: "#FFFFFF", ratio: 0.8 }],
  };
  return palette[t] || [{ hex: "#888888", ratio: 0.5 }];
}

function mockLabelsForSurface(t: SurfaceType): { label: string; confidence: number }[] {
  const labels: Record<string, { label: string; confidence: number }[]> = {
    floor: [
      { label: "wood flooring", confidence: 0.78 },
      { label: "light oak", confidence: 0.62 },
    ],
    wall: [
      { label: "white wall", confidence: 0.82 },
      { label: "wallpaper", confidence: 0.55 },
    ],
    ceiling: [{ label: "white ceiling", confidence: 0.88 }],
    tile: [{ label: "porcelain tile", confidence: 0.7 }],
    cabinet: [{ label: "wooden cabinet", confidence: 0.65 }],
    countertop: [{ label: "engineered stone", confidence: 0.6 }],
    sanitary: [{ label: "ceramic fixture", confidence: 0.75 }],
  };
  return labels[t] || [{ label: t, confidence: 0.5 }];
}
