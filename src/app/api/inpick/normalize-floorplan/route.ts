/**
 * POST /api/inpick/normalize-floorplan
 *
 * 네이버/업로드 평면도 → gpt-image-2 image edit로 워터마크 제거 + 바닥 고화질화 (raster 유지)
 *                    → GPT-4o Vision으로 실 layout 추출 (mm)
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

export const runtime = "nodejs";
export const maxDuration = 180;

const OPENAI_BASE = "https://api.openai.com/v1";

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  exclusiveAreaM2?: number;
  isHandDrawn?: boolean;
  unitName?: string;
  skipImageClean?: boolean;
  expansion?: boolean;
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
  options: { expansion?: boolean; imageMimeType?: string } = {},
): Promise<{ b64: string; costUsd: number; model: string }> {
  const expansionBlock = options.expansion
    ? "LAYOUT VARIANT = 확장형(EXTENDED). 발코니/베란다 확장 여부를 원본에서 먼저 판독하고, 확장된 부분만 거실 또는 인접 방과 하나의 공간으로 통합하세요. 철거된 경계벽은 제거하고 동일 바닥으로 연결하되 내력벽과 기둥은 절대 제거하지 마세요. "
    : "LAYOUT VARIANT = 기본형(BASIC). 발코니/베란다와 거실·침실 사이 경계벽, 창호, 출입문을 원본 그대로 분리 유지하세요. 확장형처럼 합치거나 벽을 임의로 제거하지 마세요. ";

  const prompt =
    "Korean apartment floor plan, orthographic top-down architectural drawing, ultra-clean high-resolution technical visualization. " +
    "한국 아파트 평면도를 전문 건축 CAD 도면을 고해상도 래스터로 출력한 것처럼 재구성하세요. " +
    expansionBlock +
    // 워터마크 제거
    "기존 NAVER, 네이버 부동산, 직방, 호갱노노, 호갱님, 다방 등 모든 외부 서비스 워터마크와 로고 완전히 지움. " +
    "워터마크가 있던 자리는 흰 배경과 검정 건축선으로 자연스럽게 복원하고 새로운 로고·브랜드·워터마크·문자를 추가하지 마세요. " +
    // 레이아웃 보존
    "원본의 외곽선, 실 개수, 실 배치, 벽 중심선, 출입문, 창문, 기둥, 설비 위치를 픽셀 단위로 최대한 충실히 보존. 임의로 방·문·창을 추가하거나 삭제하지 마세요. " +
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
    form.append("quality", "high");
    form.append("output_format", "png");

    const res = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
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
    const layoutVariant = body.expansion ? "extended" : "basic";
    const propertyId = body.propertyId
      || getPropertyId(
        `${body.address || "unknown"}|layout:${layoutVariant}`,
        body.aptName || body.unitName || "unknown",
        exclusiveAreaM2,
      );

    // ─── 캐시 확인 — 동일 propertyId의 normalized.png 있으면 재크롤링/처리 X ───
    if (await hasFloorplan(propertyId, "normalized")) {
      console.log(`[FLOORPLAN] cache HIT property=${propertyId}`);
      const normalizedUrl = getFloorplanUrl(propertyId, "normalized");
      const originalUrl = getFloorplanUrl(propertyId, "original");
      // metadata에 정형화 결과 저장돼 있으면 그대로 응답
      const { loadMetadata } = await import("@/lib/inpick/floorplan-storage");
      const meta = await loadMetadata(propertyId);
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
          cleanQuality: "high",
          layoutVariant,
        });
      }
    }

    console.info(`[FLOORPLAN] normalize START property=${propertyId} variant=${layoutVariant}`);

    // 1) 원본 이미지 buffer 준비. 네이버 CDN은 서버에서 필요한 헤더를 붙여 직접 읽는다.
    let imageBuf: Buffer | null = null;
    let imageMimeType = body.imageMimeType || "image/png";
    if (body.imageUrl) {
      const sourceController = new AbortController();
      const sourceTimer = setTimeout(() => sourceController.abort(), 20_000);
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
      } finally {
        clearTimeout(sourceTimer);
      }
    } else if (body.imageBase64) {
      imageBuf = Buffer.from(body.imageBase64, "base64");
    }
    console.info(`[FLOORPLAN] source READY property=${propertyId} bytes=${imageBuf?.length || 0}`);

    // 2) 외부 CDN URL 대신 동일한 원본 바이트를 Vision에 전달한다.
    // OpenAI가 네이버 URL에 직접 접근하지 못하는 경우도 안정적으로 처리된다.
    const visionPromise = analyzeImageVision({
      imageUrl: imageBuf ? undefined : body.imageUrl,
      imageBase64: imageBuf?.toString("base64") || body.imageBase64,
      imageMimeType,
      prompt: ANALYZE_PROMPT,
      responseFormat: "json_object",
    });

    // 원본은 항상 저장 (skipImageClean과 무관)
    if (imageBuf) {
      try {
        await saveFloorplan(propertyId, "original", { buffer: imageBuf, contentType: imageMimeType });
      } catch (e) {
        console.warn("[FLOORPLAN] save original failed:", e);
      }
    }
    // 3) Vision 결과 + 고화질 흑백 도면 생성을 병렬 처리
    const cleanPromise = imageBuf && !body.skipImageClean
      ? cleanFloorplanRaster(imageBuf, apiKey, {
          expansion: body.expansion,
          imageMimeType,
        })
      : Promise.resolve(null);
    const [visionRes, cleaned] = await Promise.allSettled([visionPromise, cleanPromise]);

    if (visionRes.status === "rejected") {
      return NextResponse.json(
        { error: "Vision 분석 실패", detail: String(visionRes.reason).slice(0, 300) },
        { status: 502 },
      );
    }

    // 네이버 주소 모드는 고화질 후처리 결과가 완성된 뒤에만 사용자에게 노출한다.
    if (!body.skipImageClean) {
      if (!imageBuf) {
        return NextResponse.json(
          { error: "원본 도면 이미지를 읽지 못했습니다." },
          { status: 502 },
        );
      }
      if (cleaned.status === "rejected" || !cleaned.value) {
        return NextResponse.json(
          {
            error: "고화질 평면도 후처리에 실패했습니다.",
            detail: cleaned.status === "rejected" ? String(cleaned.reason).slice(0, 300) : undefined,
          },
          { status: 502 },
        );
      }
    }

    let parsed: VisionResult;
    try {
      parsed = JSON.parse(visionRes.value.content);
    } catch {
      return NextResponse.json(
        { error: "Vision 응답 JSON 파싱 실패", raw: visionRes.value.content.slice(0, 500) },
        { status: 502 },
      );
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
        await saveFloorplan(propertyId, "normalized", { buffer: normBuf, contentType: "image/png" });
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
        await saveFloorplan(propertyId, "normalized", { buffer: imageBuf, contentType: "image/png" });
        normalizedImageUrl = getFloorplanUrl(propertyId, "normalized") || undefined;
      } catch (e) {
        console.warn("[FLOORPLAN] save normalized (from original) failed:", e);
      }
      cleanedImageUrl = normalizedImageUrl;
    }

    // metadata 저장
    try {
      await saveMetadata(propertyId, {
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
      });
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
        (cleaned.status === "rejected" ? ` · cleaning 스킵 (${String(cleaned.reason).slice(0, 100)})` : ""),
      visionRoomCount: visionRooms.length,
      cleanedImageUrl,
      normalizedImageUrl,
      originalImageUrl: getFloorplanUrl(propertyId, "original"),
      cleanCostUsd,
      cleanModel: cleaned.status === "fulfilled" ? cleaned.value?.model : undefined,
      cleanQuality: cleaned.status === "fulfilled" && cleaned.value ? "high" : undefined,
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
