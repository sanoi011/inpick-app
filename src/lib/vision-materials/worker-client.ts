/**
 * RunPod vision-materials worker 클라이언트.
 *
 * 가이드: §7
 *
 * 정책:
 *   - RunPod 미설정/실패 시 프로젝트 내 OpenAI Vision polygon 분석기로 폴백
 *   - 실제 이미지 분석까지 실패한 개발 환경에서만 mock 사용
 *   - production은 sync 또는 async 둘 다 지원 (RunPod /run /runsync)
 *   - 결과는 SurfaceObservation[] 형식으로 정규화하여 반환
 */

import type { SurfaceObservation, SurfaceType } from "./types";
import { gpt4oProvider } from "@/lib/inpick/segmentation/gpt4o-provider";
import type { InteriorCategory } from "@/types/segmentation";

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

const APPROVED_EMBEDDING_MODEL = "openclip-vit-b-32-laion2b-s34b-b79k";

function normalizeRunPodEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "").replace(/\/runsync$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://api.runpod.ai/v2/${trimmed}`;
}

function isValidEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 512) return false;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return false;
  }
  const norm = Math.sqrt(value.reduce((sum, item) => sum + item * item, 0));
  return norm >= 0.95 && norm <= 1.05;
}

/**
 * RunPod vision-materials worker 호출.
 * 전용 worker가 없으면 OpenAI Vision 폴백으로 실제 이미지를 분석한다.
 */
export async function callVisionMaterialsWorker(
  input: WorkerInput,
): Promise<WorkerOutput> {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_VISION_MATERIALS_ENDPOINT;
  // 공간/면 검출은 polygon을 반환하는 Vision 분석기가 담당한다. RunPod는
  // 검출된 실제 crop만 GPU batch embedding해 임의 화면 분할을 방지한다.
  const regionAnalysis = await visionFallbackWorkerResponse(input);
  if (!apiKey || !endpoint || regionAnalysis.source === "mock") return regionAnalysis;
  if (regionAnalysis.surfaces.length === 0) return regionAnalysis;

  const t0 = Date.now();
  try {
    const res = await fetch(`${normalizeRunPodEndpoint(endpoint)}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          mode: "embed_regions",
          image_url: input.imageUrl,
          regions: regionAnalysis.surfaces.map((surface, index) => ({
            id: String(index),
            surface_type: surface.surfaceType,
            bbox: surface.bbox,
            area_ratio: surface.areaRatio,
            coarse_labels: surface.coarseLabels,
            confidence: surface.confidence,
          })),
        },
      }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      output?: {
        surfaces?: Array<Record<string, unknown>>;
        model_versions?: Record<string, string>;
        elapsed_ms?: number;
        error?: string;
      };
      error?: string;
    };
    if (data.error || data.output?.error) throw new Error(data.error || data.output?.error);
    if (data.output?.model_versions?.embedding !== APPROVED_EMBEDDING_MODEL) {
      throw new Error(
        `unapproved embedding model: ${data.output?.model_versions?.embedding || "missing"}`,
      );
    }

    const embeddedByIndex = new Map<number, ReturnType<typeof mapWorkerSurface>>();
    for (const raw of data.output?.surfaces || []) {
      const index = Number(raw.region_id);
      const mapped = mapWorkerSurface(raw);
      if (Number.isInteger(index) && isValidEmbedding(mapped.embedding)) {
        embeddedByIndex.set(index, mapped);
      }
    }
    if (embeddedByIndex.size === 0) throw new Error("no valid region embeddings");

    const surfaces = regionAnalysis.surfaces.map((surface, index) => {
      const embedded = embeddedByIndex.get(index);
      if (!embedded) return surface;
      return {
        ...surface,
        embedding: embedded.embedding,
        dominantColors: embedded.dominantColors?.length
          ? embedded.dominantColors
          : surface.dominantColors,
      };
    });
    return {
      surfaces,
      modelVersions: {
        ...regionAnalysis.modelVersions,
        ...(data.output?.model_versions || {}),
      },
      elapsedMs: regionAnalysis.elapsedMs + (data.output?.elapsed_ms || Date.now() - t0),
      source: "real",
    };
  } catch (e) {
    console.warn(
      `[vision-materials/worker] error: ${e instanceof Error ? e.message : String(e)} — fallback vision`,
    );
    return regionAnalysis;
  }
}

async function visionFallbackWorkerResponse(input: WorkerInput): Promise<WorkerOutput> {
  const t0 = Date.now();
  try {
    const segmentation = await gpt4oProvider.segment({
      imageUrl: input.imageUrl,
      roomName: input.roomType,
    });
    const targetSet = input.targetSurfaceTypes?.length
      ? new Set(input.targetSurfaceTypes)
      : null;
    const surfaces = segmentation.regions
      .map((region): SurfaceObservation | null => {
        const surfaceType = mapInteriorCategory(region.category);
        if (!surfaceType || (targetSet && !targetSet.has(surfaceType))) return null;
        const [x, y, width, height] = region.bbox;
        const coarseLabels = [
          ...(region.guessed_material
            ? [{ label: region.guessed_material, confidence: region.confidence }]
            : []),
          { label: region.label_ko, confidence: region.confidence },
        ];
        return {
          surfaceType,
          bbox: { x, y, width, height },
          areaRatio: region.area_normalized,
          dominantColors: region.guessed_color_hex
            ? [{ hex: region.guessed_color_hex, ratio: 1 }]
            : undefined,
          coarseLabels,
          confidence: region.confidence,
        };
      })
      .filter((surface): surface is SurfaceObservation => surface !== null)
      .slice(0, input.maxSurfaces ?? 12);
    return {
      surfaces,
      modelVersions: {
        detector: "openai-vision-region-analysis",
        segmenter: "openai-vision-polygon",
        embedding: "none-category-rerank",
        ocr: "openai-vision-labels",
      },
      elapsedMs: Date.now() - t0,
      source: "real",
    };
  } catch (error) {
    console.warn(
      `[vision-materials/worker] vision fallback failed: ${error instanceof Error ? error.message : String(error)} — development mock`,
    );
    return mockWorkerResponse(input);
  }
}

function mapInteriorCategory(category: InteriorCategory): SurfaceType | null {
  switch (category) {
    case "floor":
    case "wall":
    case "ceiling":
    case "window":
    case "door":
    case "cabinet":
    case "lighting":
      return category;
    default:
      return null;
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
