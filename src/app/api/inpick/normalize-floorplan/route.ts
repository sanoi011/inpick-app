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
  skipImageClean?: boolean;  // 비용 절감 — 워터마크 제거 안 함, dimension overlay만
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

/** 평면도 raster cleaning — gpt-image-2 단일 (사용자 정책: 폴백 없음) */
async function cleanFloorplanRaster(
  imageBuf: Buffer,
  apiKey: string,
): Promise<{ b64: string; costUsd: number; model: string }> {
  const prompt =
    "한국 아파트 평면도. 모든 워터마크, 로고, NAVER/네이버 텍스트, 광고 텍스트 완전 제거. " +
    "동일한 실 레이아웃과 비율 유지. " +
    "바닥 패턴을 고화질로 재매핑: 거실/방=헤링본 우드, 욕실=정사각 타일, 주방=가로 타일, 발코니=가로 타일. " +
    "벽은 검은 두꺼운 외벽 + 회색 내벽. " +
    "깨끗한 흰 배경. 한국 인테리어 평면도 스타일. " +
    "치수 텍스트는 그리지 마세요 (별도 오버레이됨).";

  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append(
    "image",
    new Blob([new Uint8Array(imageBuf)], { type: "image/png" }),
    "image.png",
  );
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", "high");

  const res = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`gpt-image-2 ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-2 응답에 이미지 데이터 없음");
  return { b64, costUsd: 0.19, model: "gpt-image-2" };
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

    // 1) Vision으로 layout 추출 (병렬로 시작)
    const visionPromise = analyzeImageVision({
      imageUrl: body.imageUrl,
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
      prompt: ANALYZE_PROMPT,
      responseFormat: "json_object",
    });

    // 2) 원본 이미지 buffer 준비 (raster cleaning용)
    let imageBuf: Buffer | null = null;
    if (!body.skipImageClean) {
      if (body.imageUrl) {
        const r = await fetch(body.imageUrl);
        if (r.ok) imageBuf = Buffer.from(await r.arrayBuffer());
      } else if (body.imageBase64) {
        imageBuf = Buffer.from(body.imageBase64, "base64");
      }
    }

    // 3) Vision 결과 + 옵셔널 cleaning 병렬
    const [visionRes, cleaned] = await Promise.allSettled([
      visionPromise,
      imageBuf
        ? cleanFloorplanRaster(imageBuf, apiKey)
        : Promise.resolve(null),
    ]);

    if (visionRes.status === "rejected") {
      return NextResponse.json(
        { error: "Vision 분석 실패", detail: String(visionRes.reason).slice(0, 300) },
        { status: 502 },
      );
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

    // cleaned image (옵셔널)
    let cleanedImageUrl: string | undefined;
    let cleanCostUsd = 0;
    if (cleaned.status === "fulfilled" && cleaned.value) {
      cleanedImageUrl = `data:image/png;base64,${cleaned.value.b64}`;
      cleanCostUsd = cleaned.value.costUsd;
    }

    return NextResponse.json({
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
      cleanCostUsd,
      dimensionOverlaySvg,
      totalWidthMm,
      totalDepthMm,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
