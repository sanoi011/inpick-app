/**
 * POST /api/inpick/normalize-floorplan
 *
 * 주소 평형 + 네이버 평면도 있음 → 원본 형식 유지, 워터마크만 최소 정리
 * 주소 평형 + 평면도 없음        → 평형 통계 평균으로 실별 면적/치수 산출
 * 업로드 도면                    → 기존 구조 분석 호환
 *
 * 입력: { imageUrl?, imageBase64?, imageMimeType?, exclusiveAreaM2?, isHandDrawn?, unitName? }
 * 출력: {
 *   pyeong, rooms[], openings[], notes,
 *   cleanedImageUrl: string,    // data:image/png;base64,... — 워터마크 제거된 깨끗한 평면도
 *   dimensionOverlaySvg: string,// 치수 라벨만 (배경 투명, position:absolute)
 *   totalWidthMm, totalDepthMm
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { analyzeImageVision } from "@/lib/inpick/openai-client";
import { getOpenAIKey } from "@/lib/inpick/openai-env";
import {
  classifyPyeong,
  type PyungType,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";
import {
  buildDimensionOverlaySvg,
  type FloorRoomLayout,
} from "@/lib/inpick/floorplan-svg";
import {
  getPropertyId,
  saveFloorplan,
  saveMetadata,
  getFloorplanUrl,
  hasFloorplan,
} from "@/lib/inpick/floorplan-storage";
import { withFloorplanDeadline } from "@/lib/inpick/floorplan/deadline";
import { callFloorplanAIAny } from "@/lib/services/floorplan-ai-client";
import {
  floorplanAIToStructure,
  type InferredFloorplanStructure,
} from "@/lib/inpick/floorplan/inference-result";
import {
  buildAreaAveragePrompt,
  buildStandardAreaAverage,
  parseAreaAverageResponse,
  type AreaAverageInput,
} from "@/lib/inpick/floorplan/area-average";

export const runtime = "nodejs";
export const maxDuration = 180;

const OPENAI_BASE = "https://api.openai.com/v1";
const EXTENDED_LAYOUT_PIPELINE_VERSION = "extended-v4";
const WATERMARK_ONLY_PIPELINE_VERSION = "watermark-only-v1";
const CACHE_LOOKUP_TIMEOUT_MS = 3_000;
const STORAGE_WRITE_TIMEOUT_MS = 5_000;
const SOURCE_DOWNLOAD_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_MS = 35_000;
const LOCAL_INFERENCE_TIMEOUT_MS = 30_000;
const STRUCTURE_ANALYSIS_TIMEOUT_MS = 70_000;
const IMAGE_EDIT_TIMEOUT_MS = 65_000;

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  exclusiveAreaM2?: number;
  isHandDrawn?: boolean;
  unitName?: string;
  skipImageClean?: boolean;
  processingMode?:
    | "area_average"
    | "watermark_only"
    | "structure_only"
    | "clean_preview";
  roomCount?: number;
  expansion?: boolean;
  layoutVariant?: "basic" | "extended";
  /** 가이드 §1-2 — propertyId 시스템: address+aptName+areaSqm 해시로 영구 저장 */
  address?: string;
  aptName?: string;
  /** 호출자가 propertyId 직접 제공 시 그대로 사용 (재현성) */
  propertyId?: string;
}

interface StructureAnalysisResult {
  content: string;
  engine:
    | "inpick-floorplan-ai"
    | "openai-vision"
    | "openai-area-average"
    | "standard-area-average";
}

const ANALYZE_PROMPT = `이 이미지는 한국 아파트 또는 주택 평면도입니다.
워터마크·로고는 무시하세요.

반드시 valid JSON으로 응답:
{
  "totalWidthMm": <전체 가로 mm>,
  "totalDepthMm": <전체 세로 mm>,
  "rooms": [
    {
      "name": "거실|안방|주방|침실|욕실|현관|발코니|드레스룸|다이닝",
      "xMm": <도면 좌상단(0,0) 기준 절대 mm>,
      "yMm": <도면 좌상단 기준 절대 mm>,
      "widthMm": <가로>,
      "depthMm": <세로>
    }
  ],
  "openings": [{ "wall": "...", "type": "door|window", "widthMm": <>, "heightMm": <> }],
  "detectedAreaM2": <m²>,
  "notes": "..."
}

규칙:
- xMm,yMm는 절대 좌표 (실끼리 안 겹침)
- 명시 치수 우선, 미표시면 표준 비율 추정
- 욕실/침실 2개+면 "욕실1","욕실2"`;

async function estimateAreaAverageStructure(
  input: AreaAverageInput,
  apiKey?: string,
): Promise<StructureAnalysisResult> {
  const fallback = buildStandardAreaAverage(input);
  if (!apiKey) {
    return {
      content: JSON.stringify({ rooms: fallback.rooms, notes: fallback.notes }),
      engine: "standard-area-average",
    };
  }

  try {
    const response = await analyzeImageVision({
      prompt: buildAreaAveragePrompt(input),
      responseFormat: "json_object",
      maxOutputTokens: 2_048,
      reasoningEffort: "low",
      requestTimeoutMs: 20_000,
    });
    const parsed = parseAreaAverageResponse(response.content, input);
    if (parsed) {
      return {
        content: JSON.stringify({ rooms: parsed.rooms, notes: parsed.notes }),
        engine: "openai-area-average",
      };
    }
  } catch (error) {
    console.warn("[FLOORPLAN] area average prompt fallback:", error);
  }

  return {
    content: JSON.stringify({ rooms: fallback.rooms, notes: fallback.notes }),
    engine: "standard-area-average",
  };
}

/** 평면도 raster cleaning — GPT Image 2 단일 */
async function cleanFloorplanRaster(
  imageBuf: Buffer,
  apiKey: string,
  options: {
    imageMimeType?: string;
    signal?: AbortSignal;
  } = {},
): Promise<{ b64: string; costUsd: number; model: string }> {
  const prompt =
    "Minimal cleanup of the attached Korean apartment floor-plan image. " +
    "Remove only overlaid third-party watermark and logo marks. " +
    "Preserve the original drawing exactly: canvas, crop, resolution ratio, colors, room labels, " +
    "dimension numbers, furniture symbols, walls, doors, windows, balconies and every structural line. " +
    "Do not redraw it as CAD, do not convert it to black-and-white, do not simplify or beautify it, " +
    "do not change basic/extended layout, and do not invent or delete any room, line, text or symbol. " +
    "Fill only the removed overlay pixels from their immediate surrounding background. " +
    "워터마크·로고 외에는 원본 픽셀과 도면 형식을 그대로 유지하세요.";

  // GPT Image 2만 사용한다. 지원하지 않는 input_fidelity를 보내면 400으로 거절되므로 제외.
  const errors: string[] = [];
  const inputMimeType = options.imageMimeType?.startsWith("image/")
    ? options.imageMimeType
    : "image/png";
  const inputFilename = inputMimeType.includes("jpeg") ? "image.jpg" : "image.png";
  let editSize: "1536x1024" | "1024x1536" | "1024x1024" = "1536x1024";
  try {
    const metadata = await sharp(imageBuf).metadata();
    const ratio = (metadata.width || 1) / (metadata.height || 1);
    editSize = ratio > 1.15 ? "1536x1024" : ratio < 0.87 ? "1024x1536" : "1024x1024";
  } catch {
    // 원본 메타데이터를 읽지 못하면 기존 가로형 기본값을 사용한다.
  }
  for (const modelName of ["gpt-image-2"]) {
    const form = new FormData();
    form.append("model", modelName);
    form.append(
      "image",
      new Blob([new Uint8Array(imageBuf)], { type: inputMimeType }),
      inputFilename,
    );
    form.append("prompt", prompt);
    form.append("size", editSize);
    // 1536px 해상도는 유지하되 초기 도면은 medium으로 생성해 대기 시간을 줄인다.
    // 최종 인테리어 렌더의 high 품질 정책과는 별개다.
    form.append("quality", "medium");
    form.append("output_format", "png");

    const controller = new AbortController();
    const abortFromRequest = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromRequest();
    else options.signal?.addEventListener("abort", abortFromRequest, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_EDIT_TIMEOUT_MS);
    try {
      const res = await fetch(`${OPENAI_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) {
          errors.push(`${modelName}: 응답에 이미지 데이터 없음`);
          continue;
        }
        // 실제 비용은 모델 사용량/계정 과금표에서 집계한다. 여기서는 임의 추정값을 만들지 않는다.
        return { b64, costUsd: 0, model: modelName };
      }

      const errText = await res.text();
      errors.push(`${modelName} ${res.status}: ${errText.slice(0, 200)}`);
      break;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("도면 이미지 생성 시간이 초과되었습니다.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortFromRequest);
    }
  }
  throw new Error(`GPT Image 2 평면도 클리닝 실패 — ${errors.join(" | ")}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const hasImage = Boolean(body.imageUrl || body.imageBase64);
    const exclusiveAreaM2 = Number(body.exclusiveAreaM2 || 0);
    if (!hasImage && (!Number.isFinite(exclusiveAreaM2) || exclusiveAreaM2 <= 0)) {
      return NextResponse.json(
        { error: "도면 이미지 또는 전용면적이 필요합니다." },
        { status: 400 },
      );
    }
    // ─── propertyId 결정 (가이드 §1-2) ───
    const layoutVariant = body.layoutVariant ?? (body.expansion ? "extended" : "basic");
    const expansionRequested = layoutVariant === "extended";
    const processingMode =
      body.processingMode ||
      (!hasImage ? "area_average" : body.skipImageClean ? "structure_only" : "clean_preview");
    const apiKey = getOpenAIKey();

    // 도면이 없으면 주소·평형만으로 평균 실 구성을 백그라운드 산출한다.
    if (!hasImage || processingMode === "area_average") {
      const averageInput: AreaAverageInput = {
        exclusiveAreaM2,
        roomCount: body.roomCount,
        expansion: expansionRequested,
        unitName: body.unitName || body.aptName,
      };
      const average = await estimateAreaAverageStructure(averageInput, apiKey);
      const parsed = JSON.parse(average.content) as InferredFloorplanStructure;
      const rooms = (parsed.rooms || []).map((room) => ({
        name: room.name,
        widthMm: room.widthMm || 3000,
        depthMm: room.depthMm || 2800,
        heightMm: room.heightMm || 2400,
        source: "standard" as const,
      }));
      return NextResponse.json({
        pyeong: classifyPyeong(exclusiveAreaM2),
        providedAreaM2: exclusiveAreaM2,
        rooms,
        openings: [],
        notes: parsed.notes || "평형 통계 평균값 · 이미지 생성·가견적용",
        analysisEngine: average.engine,
        layoutVariant,
        totalWidthMm: 0,
        totalDepthMm: 0,
      });
    }

    if (
      (processingMode === "clean_preview" || processingMode === "watermark_only") &&
      !apiKey
    ) {
      return NextResponse.json({ error: "OpenAI 키 미설정" }, { status: 500 });
    }
    const propertyId = body.propertyId
      || getPropertyId(
        `${body.address || "unknown"}|layout:${layoutVariant}${
          expansionRequested ? `|pipeline:${EXTENDED_LAYOUT_PIPELINE_VERSION}` : ""
        }${
          processingMode === "watermark_only"
            ? `|pipeline:${WATERMARK_ONLY_PIPELINE_VERSION}`
            : ""
        }|mode:${processingMode}`,
        body.aptName || body.unitName || "unknown",
        exclusiveAreaM2,
      );

    // ─── 캐시 확인 — 동일 propertyId의 normalized.png 있으면 재크롤링/처리 X ───
    let cached = false;
    try {
      cached = await withFloorplanDeadline(
        hasFloorplan(propertyId, "normalized"),
        CACHE_LOOKUP_TIMEOUT_MS,
        "floorplan cache lookup",
      );
    } catch (error) {
      console.warn("[FLOORPLAN] cache lookup skipped:", error);
    }
    if (cached) {
      console.log(`[FLOORPLAN] cache HIT property=${propertyId}`);
      const normalizedUrl = getFloorplanUrl(propertyId, "normalized");
      const originalUrl = getFloorplanUrl(propertyId, "original");
      // metadata에 정형화 결과 저장돼 있으면 그대로 응답
      const { loadMetadata } = await import("@/lib/inpick/floorplan-storage");
      let meta = null;
      try {
        meta = await withFloorplanDeadline(
          loadMetadata(propertyId),
          CACHE_LOOKUP_TIMEOUT_MS,
          "floorplan metadata lookup",
        );
      } catch (error) {
        console.warn("[FLOORPLAN] metadata lookup skipped:", error);
      }
      if (meta) {
        return NextResponse.json({
          property_id: propertyId,
          cached: true,
          normalizedImageUrl: normalizedUrl,
          originalImageUrl: originalUrl,
          cleanedImageUrl: normalizedUrl,
          rooms: (meta.rooms || []).map((room) => ({
            ...room,
            heightMm: 2400,
            source: "standard" as const,
          })),
          totalWidthMm: meta.total_width_mm || 0,
          totalDepthMm: meta.total_depth_mm || 0,
          pyeong: meta.pyeong || classifyPyeong(exclusiveAreaM2 || 84.9),
          openings: [],
          notes: "cache hit",
          cleanModel: "cache",
          cleanQuality: meta.clean_quality || "high",
          layoutVariant,
        });
      }
      // 이미지 캐시는 유효하지만 메타데이터 저장소만 느린 경우에도 재생성하지 않는다.
      // 실 치수는 전용면적 표준값으로 즉시 복구하고 다음 단계에서 보강할 수 있다.
      const cachedAverage = buildStandardAreaAverage({
        exclusiveAreaM2: exclusiveAreaM2 || 84.9,
        roomCount: body.roomCount,
        expansion: expansionRequested,
        unitName: body.unitName || body.aptName,
      });
      return NextResponse.json({
        property_id: propertyId,
        cached: true,
        normalizedImageUrl: normalizedUrl,
        originalImageUrl: originalUrl,
        cleanedImageUrl: normalizedUrl,
        rooms: cachedAverage.rooms.map((room) => ({
          ...room,
          source: "standard" as const,
        })),
        totalWidthMm: 0,
        totalDepthMm: 0,
        pyeong: cachedAverage.pyeong,
        openings: [],
        notes: "cache hit · 평형 평균 실 치수 적용",
        cleanModel: "cache",
        cleanQuality: "high",
        layoutVariant,
      });
    }

    console.info(`[FLOORPLAN] normalize START property=${propertyId} variant=${layoutVariant}`);

    // 1) 원본 이미지 buffer 준비. 네이버 CDN은 서버에서 필요한 헤더를 붙여 직접 읽는다.
    let imageBuf: Buffer | null = null;
    let imageMimeType = body.imageMimeType || "image/png";
    if (body.imageUrl) {
      const sourceController = new AbortController();
      const abortSourceFromRequest = () => sourceController.abort(req.signal.reason);
      if (req.signal.aborted) abortSourceFromRequest();
      else req.signal.addEventListener("abort", abortSourceFromRequest, { once: true });
      const sourceTimer = setTimeout(() => sourceController.abort(), SOURCE_DOWNLOAD_TIMEOUT_MS);
      try {
        const r = await fetch(body.imageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            Referer: "https://new.land.naver.com/",
          },
          signal: sourceController.signal,
        });
        if (r.ok) {
          imageBuf = Buffer.from(await r.arrayBuffer());
          imageMimeType = r.headers.get("content-type")?.split(";")[0] || imageMimeType;
        } else {
          console.warn(`[FLOORPLAN] source download failed status=${r.status}`);
        }
      } catch (error) {
        console.warn("[FLOORPLAN] source download failed:", error);
      } finally {
        clearTimeout(sourceTimer);
        req.signal.removeEventListener("abort", abortSourceFromRequest);
      }
    } else if (body.imageBase64) {
      imageBuf = Buffer.from(body.imageBase64, "base64");
    }
    console.info(`[FLOORPLAN] source READY property=${propertyId} bytes=${imageBuf?.length || 0}`);

    if (!imageBuf) {
      return NextResponse.json(
        { error: "원본 도면 이미지를 읽지 못했습니다." },
        { status: 502 },
      );
    }

    // 2) 외부 CDN URL 대신 동일한 원본 바이트를 Vision에 전달한다.
    // OpenAI가 네이버 URL에 직접 접근하지 못하는 경우도 안정적으로 처리된다.
    const localInferenceConfigured = Boolean(
      process.env.FLOORPLAN_AI_URL || process.env.PDF_PARSER_V47_URL,
    );
    const visionPromise = withFloorplanDeadline(
      (async (): Promise<StructureAnalysisResult> => {
        if (processingMode === "watermark_only") {
          return estimateAreaAverageStructure(
            {
              exclusiveAreaM2: exclusiveAreaM2 || 84.9,
              roomCount: body.roomCount,
              expansion: expansionRequested,
              unitName: body.unitName || body.aptName,
            },
            apiKey,
          );
        }
        if (processingMode === "structure_only" && localInferenceConfigured) {
          const local = await callFloorplanAIAny(
            imageBuf,
            imageMimeType.includes("jpeg") ? "floorplan.jpg" : "floorplan.png",
            LOCAL_INFERENCE_TIMEOUT_MS,
          );
          if (local) {
            return {
              content: JSON.stringify(floorplanAIToStructure(local)),
              engine: "inpick-floorplan-ai",
            };
          }
        }
        if (!apiKey) throw new Error("structure analyzer unavailable");
        const result = await analyzeImageVision({
          imageBase64: imageBuf.toString("base64"),
          imageMimeType,
          prompt: ANALYZE_PROMPT,
          responseFormat: "json_object",
          maxOutputTokens: 4_096,
          reasoningEffort: "medium",
          requestTimeoutMs: VISION_TIMEOUT_MS,
        });
        return { content: result.content, engine: "openai-vision" };
      })(),
      processingMode === "structure_only"
        ? STRUCTURE_ANALYSIS_TIMEOUT_MS
        : processingMode === "watermark_only"
          ? 21_000
        : VISION_TIMEOUT_MS + 1_000,
      "floorplan structure analysis",
    );

    // 저장소 장애가 AI 생성 시작 자체를 막지 않도록 원본 저장은 병렬·제한시간으로 처리한다.
    const originalSavePromise = withFloorplanDeadline(
      saveFloorplan(propertyId, "original", { buffer: imageBuf, contentType: imageMimeType }),
      STORAGE_WRITE_TIMEOUT_MS,
      "floorplan original save",
    ).catch((error) => console.warn("[FLOORPLAN] save original skipped:", error));
    // 3) 실별 평균값 산출/구조 분석과 최소 워터마크 정리를 병렬 처리한다.
    const cleanPromise = !body.skipImageClean
      ? withFloorplanDeadline(
          cleanFloorplanRaster(imageBuf, apiKey!, {
            imageMimeType,
            signal: req.signal,
          }),
          IMAGE_EDIT_TIMEOUT_MS + 1_000,
          "floorplan image edit",
        )
      : Promise.resolve(null);
    const [visionRes, cleaned] = await Promise.allSettled([visionPromise, cleanPromise]);
    await originalSavePromise;

    // 네이버 주소 모드는 도면 후처리 결과가 완성된 뒤에만 사용자에게 노출한다.
    if (!body.skipImageClean && processingMode !== "watermark_only") {
      if (cleaned.status === "rejected" || !cleaned.value) {
        return NextResponse.json(
          {
            error: "평면도 후처리에 실패했습니다.",
            detail: cleaned.status === "rejected" ? String(cleaned.reason).slice(0, 300) : undefined,
          },
          { status: 502 },
        );
      }
    }

    // 분석 실패 시에도 면적별 평균 치수로 안전하게 계속한다.
    let parsed: InferredFloorplanStructure = {};
    let analysisEngine = "standard-dimensions";
    if (visionRes.status === "fulfilled") {
      try {
        parsed = JSON.parse(visionRes.value.content);
        analysisEngine = visionRes.value.engine;
      } catch (error) {
        console.warn("[FLOORPLAN] vision JSON fallback:", error);
      }
    } else {
      console.warn("[FLOORPLAN] vision fallback:", visionRes.reason);
    }

    const areaM2 = body.exclusiveAreaM2 ?? parsed.detectedAreaM2 ?? 84.9;
    const pyeong: PyungType = classifyPyeong(areaM2);
    const areaAverageMode =
      analysisEngine === "openai-area-average" ||
      analysisEngine === "standard-area-average";
    const averageFallback = buildStandardAreaAverage({
      exclusiveAreaM2: areaM2,
      roomCount: body.roomCount,
      expansion: expansionRequested,
      unitName: body.unitName || body.aptName,
    });
    const standard: Record<string, RoomDim> = Object.fromEntries(
      averageFallback.rooms.map((room) => [room.name, room]),
    );

    // 실 머지 (Vision + 표준 fallback)
    const visionRooms = parsed.rooms || [];
    const merged: Array<RoomDim & { source: "vision" | "standard"; xMm?: number; yMm?: number }> = [];
    const seen = new Set<string>();
    for (const vr of visionRooms) {
      if (!vr.name) continue;
      const std = standard[vr.name];
      merged.push({
        name: vr.name,
        widthMm: vr.widthMm && vr.widthMm > 500 ? vr.widthMm : std?.widthMm ?? 3000,
        depthMm: vr.depthMm && vr.depthMm > 500 ? vr.depthMm : std?.depthMm ?? 2800,
        heightMm: vr.heightMm ?? std?.heightMm ?? 2400,
        xMm: vr.xMm,
        yMm: vr.yMm,
        source:
          !areaAverageMode && vr.widthMm && vr.depthMm ? "vision" : "standard",
      });
      seen.add(vr.name);
    }
    if (!areaAverageMode || merged.length === 0) {
      for (const [name, dim] of Object.entries(standard)) {
        if (seen.has(name)) continue;
        merged.push({ ...dim, source: "standard" });
      }
    }

    // dimension overlay 좌표 생성 (Vision 좌표 우선, 없으면 자동 grid)
    const layout: FloorRoomLayout[] = [];
    const haveCoords = merged.some((m) => m.xMm != null && m.yMm != null);
    if (haveCoords) {
      for (const m of merged) {
        if (m.xMm == null || m.yMm == null) continue;
        layout.push({
          name: m.name,
          xMm: m.xMm,
          yMm: m.yMm,
          widthMm: m.widthMm,
          depthMm: m.depthMm,
        });
      }
    } else {
      // Vision이 좌표 안 줬을 때 단순 row-pack
      let cursorX = 0, cursorY = 0, rowMaxY = 0;
      const maxRowWidth = Math.sqrt(
        merged.reduce((s, r) => s + r.widthMm * r.depthMm, 0),
      ) * 1.4;
      for (const m of merged) {
        if (cursorX + m.widthMm > maxRowWidth && cursorX > 0) {
          cursorX = 0;
          cursorY += rowMaxY;
          rowMaxY = 0;
        }
        layout.push({
          name: m.name,
          xMm: cursorX,
          yMm: cursorY,
          widthMm: m.widthMm,
          depthMm: m.depthMm,
        });
        cursorX += m.widthMm;
        rowMaxY = Math.max(rowMaxY, m.depthMm);
      }
    }

    // 외곽 bounding box
    let totalWidthMm = parsed.totalWidthMm || 0;
    let totalDepthMm = parsed.totalDepthMm || 0;
    if (!totalWidthMm || !totalDepthMm) {
      let maxX = 0, maxY = 0;
      for (const r of layout) {
        maxX = Math.max(maxX, r.xMm + r.widthMm);
        maxY = Math.max(maxY, r.yMm + r.depthMm);
      }
      totalWidthMm = maxX;
      totalDepthMm = maxY;
    }

    const dimensionOverlaySvg = buildDimensionOverlaySvg({
      rooms: layout,
      totalWidthMm,
      totalDepthMm,
      showRoomLabels: true,
      showRoomDimensions: true,
      showOuterDimensions: true,
    });

    // cleaned image (옵셔널) — 가이드 §1-2 'normalized.png' 영구 저장
    let cleanedImageUrl: string | undefined;
    let cleanCostUsd = 0;
    let normalizedImageUrl: string | undefined;
    if (cleaned.status === "fulfilled" && cleaned.value) {
      const normBuf = Buffer.from(cleaned.value.b64, "base64");
      try {
        await withFloorplanDeadline(
          saveFloorplan(propertyId, "normalized", { buffer: normBuf, contentType: "image/png" }),
          STORAGE_WRITE_TIMEOUT_MS,
          "floorplan normalized save",
        );
        normalizedImageUrl = getFloorplanUrl(propertyId, "normalized") || undefined;
      } catch (e) {
        console.warn("[FLOORPLAN] save normalized failed:", e);
      }
      // 호환 — 클라가 dataURL 받던 케이스 유지 (storage URL이 우선)
      cleanedImageUrl = normalizedImageUrl || `data:image/png;base64,${cleaned.value.b64}`;
      cleanCostUsd = cleaned.value.costUsd;
    } else if (imageBuf && body.skipImageClean) {
      // cleaning 스킵 시 원본을 normalized로 복사 (edits API용 stable URL 확보)
      try {
        await withFloorplanDeadline(
          saveFloorplan(propertyId, "normalized", { buffer: imageBuf, contentType: imageMimeType }),
          STORAGE_WRITE_TIMEOUT_MS,
          "floorplan normalized source save",
        );
        normalizedImageUrl = getFloorplanUrl(propertyId, "normalized") || undefined;
      } catch (e) {
        console.warn("[FLOORPLAN] save normalized (from original) failed:", e);
      }
      cleanedImageUrl = normalizedImageUrl || `data:${imageMimeType};base64,${imageBuf.toString("base64")}`;
    }

    // metadata 저장
    try {
      await withFloorplanDeadline(saveMetadata(propertyId, {
        property_id: propertyId,
        address: body.address || "unknown",
        apt_name: body.aptName || body.unitName || "unknown",
        area_sqm: areaM2,
        source_url: body.imageUrl || "(base64)",
        cached_at: new Date().toISOString(),
        rooms: merged.map((r) => ({ name: r.name, widthMm: r.widthMm, depthMm: r.depthMm })),
        total_width_mm: totalWidthMm,
        total_depth_mm: totalDepthMm,
        pyeong,
        layout_variant: layoutVariant,
        clean_model: cleaned.status === "fulfilled" ? cleaned.value?.model : undefined,
        clean_quality: cleaned.status === "fulfilled" && cleaned.value ? "medium" : undefined,
      }), STORAGE_WRITE_TIMEOUT_MS, "floorplan metadata save");
    } catch (e) {
      console.warn("[FLOORPLAN] save metadata failed:", e);
    }

    return NextResponse.json({
      property_id: propertyId,
      pyeong,
      detectedAreaM2: parsed.detectedAreaM2,
      providedAreaM2: body.exclusiveAreaM2,
      rooms: merged,
      openings: parsed.openings || [],
      notes:
        (parsed.notes || "") +
        (body.isHandDrawn ? " · 손도면 — 치수 추정 신뢰도 낮음" : "") +
        (haveCoords ? "" : " · 좌표 자동 배치 (Vision 미제공)") +
        (visionRes.status === "rejected" ? " · 실 치수 표준값 적용" : "") +
        (cleaned.status === "rejected" ? ` · cleaning 스킵 (${String(cleaned.reason).slice(0, 100)})` : ""),
      visionRoomCount: visionRooms.length,
      cleanedImageUrl,
      normalizedImageUrl,
      originalImageUrl: getFloorplanUrl(propertyId, "original"),
      cleanCostUsd,
      cleanModel: cleaned.status === "fulfilled" ? cleaned.value?.model : undefined,
      cleanQuality: cleaned.status === "fulfilled" && cleaned.value ? "medium" : undefined,
      analysisEngine,
      layoutVariant,
      dimensionOverlaySvg,
      totalWidthMm,
      totalDepthMm,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
