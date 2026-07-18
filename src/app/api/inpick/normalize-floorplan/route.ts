/**
 * POST /api/inpick/normalize-floorplan
 *
 * 네이버/업로드 평면도 → gpt-image-2 image edit로 워터마크 제거 + 바닥 고화질화 (raster 유지)
 *                    → GPT-5.6 Sol Vision으로 실 layout 추출 (mm)
 *                    → dimension overlay SVG 생성 (raster 위에 absolute로 얹힘)
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
import { analyzeImageVision } from "@/lib/inpick/openai-client";
import { getOpenAIKey } from "@/lib/inpick/openai-env";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
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

export const runtime = "nodejs";
export const maxDuration = 180;

const OPENAI_BASE = "https://api.openai.com/v1";
const EXTENDED_LAYOUT_PIPELINE_VERSION = "extended-v4";
const CACHE_LOOKUP_TIMEOUT_MS = 3_000;
const STORAGE_WRITE_TIMEOUT_MS = 5_000;
const SOURCE_DOWNLOAD_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_MS = 35_000;
const IMAGE_EDIT_TIMEOUT_MS = 65_000;

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  exclusiveAreaM2?: number;
  isHandDrawn?: boolean;
  unitName?: string;
  skipImageClean?: boolean;
  expansion?: boolean;
  layoutVariant?: "basic" | "extended";
  /** 가이드 §1-2 — propertyId 시스템: address+aptName+areaSqm 해시로 영구 저장 */
  address?: string;
  aptName?: string;
  /** 호출자가 propertyId 직접 제공 시 그대로 사용 (재현성) */
  propertyId?: string;
}

interface VisionRoom {
  name: string;
  widthMm?: number;
  depthMm?: number;
  xMm?: number;
  yMm?: number;
}

interface VisionResult {
  rooms?: VisionRoom[];
  openings?: { wall?: string; type?: string; widthMm?: number; heightMm?: number }[];
  detectedAreaM2?: number;
  totalWidthMm?: number;
  totalDepthMm?: number;
  notes?: string;
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

/** 평면도 raster cleaning — GPT Image 2 단일 */
async function cleanFloorplanRaster(
  imageBuf: Buffer,
  apiKey: string,
  options: {
    layoutVariant?: "basic" | "extended";
    imageMimeType?: string;
    signal?: AbortSignal;
  } = {},
): Promise<{ b64: string; costUsd: number; model: string }> {
  const expansionBlock = options.layoutVariant === "extended"
    ? `LAYOUT VARIANT = 확장형(EXTENDED) — 이것은 단순 정리가 아니라 원본 기본형을 확장형으로 변환하는 필수 편집입니다.
1. 원본에서 거실 또는 침실과 직접 맞닿은 발코니·베란다를 모두 찾으세요.
2. 각 인접 실과 발코니 사이의 비내력 경계벽, 분합문, 창호선과 문 호(arc)를 제거하고 두 영역을 하나의 실로 합치세요.
3. 합쳐진 영역은 인접 거실·침실과 동일한 흰 바탕으로 끊김 없이 연결하고, 실의 외곽은 기존 발코니 외벽까지 넓히세요.
4. 외기에 면한 발코니 바깥쪽 창호, 내력벽, 기둥, 샤프트, 주방 다용도실과 습식 설비 발코니는 그대로 보존하세요.
5. 확장 결과는 기본형과 시각적으로 명확히 달라야 합니다. 거실·침실과 발코니 사이의 내부 구획선이 남아 있으면 실패입니다.
6. 임의의 새 방·문·창을 만들지 말고 원본에서 실제로 인접한 발코니만 확장하세요. `
    : `LAYOUT VARIANT = 기본형(BASIC) — 원본 기본형을 그대로 보존하는 필수 편집입니다.
거실·침실과 발코니·베란다 사이의 경계벽, 분합문, 창호선과 출입문 호(arc)를 모두 유지하세요. 발코니를 실내와 합치거나 벽을 제거하지 마세요. `;

  const structurePreservationBlock = options.layoutVariant === "extended"
    ? "위에서 지정한 거실·침실-발코니 사이의 내부 경계만 제거 예외입니다. 그 외 외곽선, 실 개수, 비확장 벽, 출입문, 외기에 면한 창문, 기둥과 설비 위치는 픽셀 단위로 보존하고 임의로 추가·삭제하지 마세요. "
    : "원본의 외곽선, 실 개수, 실 배치, 벽 중심선, 출입문, 창문, 기둥과 설비 위치를 픽셀 단위로 보존하고 임의로 방·문·창을 추가하거나 삭제하지 마세요. ";

  const prompt =
    "Korean apartment floor plan, orthographic top-down architectural drawing, ultra-clean high-resolution technical visualization. " +
    "한국 아파트 평면도를 전문 건축 CAD 도면을 고해상도 래스터로 출력한 것처럼 재구성하세요. " +
    expansionBlock +
    // 워터마크 제거
    "기존 NAVER, 네이버 부동산, 직방, 호갱노노, 호갱님, 다방 등 모든 외부 서비스 워터마크와 로고 완전히 지움. " +
    "워터마크가 있던 자리는 흰 배경과 검정 건축선으로 자연스럽게 복원하고 새로운 로고·브랜드·워터마크·문자를 추가하지 마세요. " +
    // 레이아웃 보존 — 확장형의 내부 경계 제거만 명시적 예외
    structurePreservationBlock +
    "원본에 표기된 숫자 치수는 구조 판단에만 참고하고 새 숫자 치수나 면적 텍스트를 이미지 안에 생성하지 마세요. 치수는 별도 SVG 레이어로 표시합니다. " +
    // 흑백 건축도면 표현
    "색상, 바닥재 텍스처, 가구 렌더, 재질 표현을 모두 제거하고 검정 선과 흰 배경만 사용하세요. " +
    "벽 표현: 외벽 = 두꺼운 순검정 이중선, 내벽 = 얇은 순검정 이중선, 출입문 = 검정 호(arc), 창문 = 검정 두 줄 평행선, 기둥 = 검정 윤곽선. 회색·컬러 선 금지. " +
    // 배경
    "배경: 순백색 (#FFFFFF), 정투영, 균일한 선 굵기, 날카로운 모서리, 그림자·원근·노이즈·블러·JPEG 아티팩트 없음. " +
    // 금지
    "치수 텍스트, 한글 라벨, 화살표, 가구 일러스트는 그리지 마세요 (별도 SVG 오버레이로 처리). " +
    "어떤 브랜드 로고나 워터마크도 추가하지 말고 검정 건축선 외 컬러 요소를 만들지 마세요.";

  // GPT Image 2만 사용한다. 지원하지 않는 input_fidelity를 보내면 400으로 거절되므로 제외.
  const errors: string[] = [];
  const inputMimeType = options.imageMimeType?.startsWith("image/")
    ? options.imageMimeType
    : "image/png";
  const inputFilename = inputMimeType.includes("jpeg") ? "image.jpg" : "image.png";
  for (const modelName of ["gpt-image-2"]) {
    const form = new FormData();
    form.append("model", modelName);
    form.append(
      "image",
      new Blob([new Uint8Array(imageBuf)], { type: inputMimeType }),
      inputFilename,
    );
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
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
    if (!body.imageUrl && !body.imageBase64) {
      return NextResponse.json(
        { error: "imageUrl 또는 imageBase64 필수" },
        { status: 400 },
      );
    }
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI 키 미설정" }, { status: 500 });
    }

    // ─── propertyId 결정 (가이드 §1-2) ───
    const exclusiveAreaM2 = body.exclusiveAreaM2 ?? 0;
    const layoutVariant = body.layoutVariant ?? (body.expansion ? "extended" : "basic");
    const expansionRequested = layoutVariant === "extended";
    const propertyId = body.propertyId
      || getPropertyId(
        `${body.address || "unknown"}|layout:${layoutVariant}${
          expansionRequested ? `|pipeline:${EXTENDED_LAYOUT_PIPELINE_VERSION}` : ""
        }`,
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
          rooms: meta.rooms || [],
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
      const cachedPyeong = classifyPyeong(exclusiveAreaM2 || 84.9);
      return NextResponse.json({
        property_id: propertyId,
        cached: true,
        normalizedImageUrl: normalizedUrl,
        originalImageUrl: originalUrl,
        cleanedImageUrl: normalizedUrl,
        rooms: Object.values(estimateRoomDimsFromPyeong(cachedPyeong)).map((room) => ({
          ...room,
          source: "standard" as const,
        })),
        totalWidthMm: 0,
        totalDepthMm: 0,
        pyeong: cachedPyeong,
        openings: [],
        notes: "cache hit · 실 치수 표준값 적용",
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
    const visionPromise = withFloorplanDeadline(
      analyzeImageVision({
        imageBase64: imageBuf.toString("base64"),
        imageMimeType,
        prompt: ANALYZE_PROMPT,
        responseFormat: "json_object",
        maxOutputTokens: 4_096,
        reasoningEffort: "medium",
        requestTimeoutMs: VISION_TIMEOUT_MS,
      }),
      VISION_TIMEOUT_MS + 1_000,
      "floorplan vision analysis",
    );

    // 저장소 장애가 AI 생성 시작 자체를 막지 않도록 원본 저장은 병렬·제한시간으로 처리한다.
    const originalSavePromise = withFloorplanDeadline(
      saveFloorplan(propertyId, "original", { buffer: imageBuf, contentType: imageMimeType }),
      STORAGE_WRITE_TIMEOUT_MS,
      "floorplan original save",
    ).catch((error) => console.warn("[FLOORPLAN] save original skipped:", error));
    // 3) Vision 결과 + 흑백 도면 생성을 병렬 처리
    const cleanPromise = !body.skipImageClean
      ? withFloorplanDeadline(
          cleanFloorplanRaster(imageBuf, apiKey, {
            layoutVariant,
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
    if (!body.skipImageClean) {
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

    // Vision은 치수/실 정보 보강용이다. 실패해도 면적별 표준 치수로 안전하게 계속한다.
    let parsed: VisionResult = {};
    if (visionRes.status === "fulfilled") {
      try {
        parsed = JSON.parse(visionRes.value.content);
      } catch (error) {
        console.warn("[FLOORPLAN] vision JSON fallback:", error);
      }
    } else {
      console.warn("[FLOORPLAN] vision fallback:", visionRes.reason);
    }

    const areaM2 = body.exclusiveAreaM2 ?? parsed.detectedAreaM2 ?? 84.9;
    const pyeong: PyungType = classifyPyeong(areaM2);
    const standard: Record<string, RoomDim> = estimateRoomDimsFromPyeong(pyeong);

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
        heightMm: std?.heightMm ?? 2400,
        xMm: vr.xMm,
        yMm: vr.yMm,
        source: vr.widthMm && vr.depthMm ? "vision" : "standard",
      });
      seen.add(vr.name);
    }
    for (const [name, dim] of Object.entries(standard)) {
      if (seen.has(name)) continue;
      merged.push({ ...dim, source: "standard" });
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
