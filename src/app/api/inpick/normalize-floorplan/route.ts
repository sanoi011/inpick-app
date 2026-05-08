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
  /** 확장형 — true면 발코니 확장된 평면으로 수정 (거실/방과 통합) */
  expansion?: boolean;
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
  options: { expansion?: boolean } = {},
): Promise<{ b64: string; costUsd: number; model: string }> {
  const expansionBlock = options.expansion
    ? "확장형 도면으로 수정: 발코니/베란다 영역을 거실 또는 인접한 방과 하나의 공간으로 통합 (벽 제거, 바닥 통일). " +
      "확장된 거실은 원래 거실 + 발코니 면적이 더해진 더 넓은 공간으로 표현. "
    : "";

  const prompt =
    "Korean apartment floor plan, top-down architectural view, premium magazine quality. " +
    "한국 아파트 평면도, 위에서 본 깔끔한 건축 도면 스타일. " +
    expansionBlock +
    // 워터마크 교체 (AIOD)
    "기존 NAVER, 네이버 부동산, 직방, 호갱노노, 호갱님, 다방 등 모든 외부 서비스 워터마크와 로고 완전히 지움. " +
    "그 자리 또는 우하단 모서리에 'AIOD' 라는 얇은 회색 텍스트 워터마크만 작게 표기 (font: clean sans-serif, color: #999, size: small, opacity 0.5). " +
    // 레이아웃 보존
    "동일한 실 레이아웃과 비율, 벽 위치, 출입문 위치, 창문 위치 그대로 유지. 임의로 방 추가/삭제 금지. " +
    // 매핑 강화 (이쁘게)
    "바닥 패턴 고화질 재매핑 (사실적이고 정갈하게): " +
    "- 거실 + 침실 + 안방: 헤링본 패턴 우드 마루 (warm oak tone, herringbone parquet) " +
    "- 주방 + 다이닝: 라이트 그레이 가로 long-format 우드 (subtle grain) " +
    "- 욕실 + 화장실: 화이트 정사각 600×600 타일 (clean white square tile, thin grout) " +
    "- 발코니/베란다 (확장 X): 라이트 그레이 가로 데크 타일 " +
    "- 현관 + 다용도실: 다크 그레이 600×600 폴리싱 타일 " +
    "- 드레스룸: 거실과 동일 헤링본 우드 " +
    "- 팬트리: 주방과 동일 가로 우드 " +
    // 벽 표현
    "벽 표현: 외벽 = 두꺼운 검정 라인 (3~4px), 내벽 = 얇은 회색 라인 (1~2px), 출입문 = 호(arc) 표시, 창문 = 두 줄 평행선. " +
    // 배경
    "배경: 깨끗한 화이트 (#FFFFFF), 그림자/노이즈/JPEG 아티팩트 없음. " +
    // 금지
    "치수 텍스트, 한글 라벨, 화살표, 가구 일러스트는 그리지 마세요 (별도 SVG 오버레이로 처리). " +
    "어떤 외부 브랜드 로고도 추가 금지. AIOD 워터마크 외 다른 텍스트 절대 X.";

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
        ? cleanFloorplanRaster(imageBuf, apiKey, { expansion: body.expansion })
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
