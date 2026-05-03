/**
 * POST /api/inpick/normalize-floorplan
 *
 * 평면도(네이버 호출 또는 업로드) → GPT-4o Vision → 정형 JSON
 * - 워터마크 무시
 * - 실별 명칭·치수(추정) 추출
 * - 출입문·창호 위치 추출
 * - 평형 분류 + 표준 치수 fallback 보강
 *
 * 입력: { imageUrl?: string, imageBase64?: string, exclusiveAreaM2?: number, isHandDrawn?: boolean }
 * 출력: {
 *   pyeong: PyungType,
 *   rooms: { name, widthMm, depthMm, heightMm, source: "vision"|"standard" }[],
 *   openings: { wall, type, widthMm, heightMm }[],
 *   notes: string,
 *   raw: any
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { analyzeImageVision } from "@/lib/inpick/openai-client";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  type PyungType,
  type RoomDim,
} from "@/lib/inpick/korean-apt-dimensions";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  exclusiveAreaM2?: number;
  isHandDrawn?: boolean;
}

interface VisionRoom {
  name: string;
  widthMm?: number;
  depthMm?: number;
}

interface VisionResult {
  rooms?: VisionRoom[];
  openings?: { wall?: string; type?: string; widthMm?: number; heightMm?: number }[];
  detectedAreaM2?: number;
  notes?: string;
}

const ANALYZE_PROMPT = `이 이미지는 한국 아파트 또는 주택 평면도입니다.
워터마크·로고·광고 텍스트는 무시하세요.

다음 JSON 스키마로 응답하세요 (반드시 valid JSON object):
{
  "rooms": [
    { "name": "거실|안방|주방|침실|침실1|침실2|욕실|욕실1|욕실2|현관|발코니|드레스룸|팬트리|다이닝|서재", "widthMm": <정수 mm>, "depthMm": <정수 mm> }
  ],
  "openings": [
    { "wall": "현관|거실 발코니측|안방 발코니측|...", "type": "door|window|sliding", "widthMm": <정수>, "heightMm": <정수> }
  ],
  "detectedAreaM2": <전체 전용면적 추정치 m² 단위>,
  "notes": "특이사항 (예: 손도면이라 치수 불명확, 평면도에 치수 표시됨 등)"
}

규칙:
- 평면도에 명시된 치수를 우선 사용 (보통 mm 단위)
- 치수 미표시 시 한국 아파트 표준 비율로 추정
- 실 명칭은 한글 표준명만 사용 (예: "안방", "거실", "주방")
- 욕실이 2개면 "욕실1", "욕실2" 식으로 구분
- 손도면이면 정확도 낮음을 notes에 명시`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.imageUrl && !body.imageBase64) {
      return NextResponse.json(
        { error: "imageUrl 또는 imageBase64 필수" },
        { status: 400 },
      );
    }

    const visionRes = await analyzeImageVision({
      imageUrl: body.imageUrl,
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
      prompt: ANALYZE_PROMPT,
      responseFormat: "json_object",
    });

    let parsed: VisionResult;
    try {
      parsed = JSON.parse(visionRes.content);
    } catch {
      return NextResponse.json(
        { error: "Vision 응답 JSON 파싱 실패", raw: visionRes.content.slice(0, 500) },
        { status: 502 },
      );
    }

    // 평형 분류 (사용자 입력 우선, 없으면 Vision 추정)
    const areaM2 = body.exclusiveAreaM2 ?? parsed.detectedAreaM2 ?? 84.9;
    const pyeong: PyungType = classifyPyeong(areaM2);
    const standard: Record<string, RoomDim> = estimateRoomDimsFromPyeong(pyeong);

    // Vision 결과 + 표준 fallback 머지
    const visionRooms = parsed.rooms || [];
    const visionByName = new Map<string, VisionRoom>();
    for (const r of visionRooms) {
      if (r.name) visionByName.set(r.name, r);
    }

    const merged: Array<RoomDim & { source: "vision" | "standard" }> = [];
    const seen = new Set<string>();

    // 1) Vision 인식된 실 우선
    for (const vr of visionRooms) {
      if (!vr.name) continue;
      const std = standard[vr.name];
      const heightMm = std?.heightMm ?? 2400;
      merged.push({
        name: vr.name,
        widthMm: vr.widthMm && vr.widthMm > 500 ? vr.widthMm : std?.widthMm ?? 3000,
        depthMm: vr.depthMm && vr.depthMm > 500 ? vr.depthMm : std?.depthMm ?? 2800,
        heightMm,
        source: vr.widthMm && vr.depthMm ? "vision" : "standard",
      });
      seen.add(vr.name);
    }

    // 2) 표준에는 있는데 Vision이 못 본 실 추가
    for (const [name, dim] of Object.entries(standard)) {
      if (seen.has(name)) continue;
      merged.push({ ...dim, source: "standard" });
    }

    return NextResponse.json({
      pyeong,
      detectedAreaM2: parsed.detectedAreaM2,
      providedAreaM2: body.exclusiveAreaM2,
      rooms: merged,
      openings: parsed.openings || [],
      notes:
        (parsed.notes || "") +
        (body.isHandDrawn ? " · 손도면 입력 — 치수 추정치 신뢰도 낮음, 사용자 확인 필요" : ""),
      visionRoomCount: visionRooms.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
