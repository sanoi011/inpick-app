/**
 * POST /api/inpick/analyze-floorplan
 *
 * 입력 (JSON):
 *  - imageUrl: 평면도 URL (네이버부동산 추출 또는 사용자 업로드)
 *  - imageBase64: 또는 base64
 *  - exclusiveAreaM2: 전용면적 (선택, 알면 정확도↑)
 *
 * 출력:
 *  - pyeong: 평형 (15평~50평)
 *  - rooms: { 거실: {widthMm, depthMm, heightMm, areaM2}, ... }
 *  - totalAreaM2
 *  - source: "vision" | "standard_db"
 */
import { NextRequest, NextResponse } from "next/server";
import {
  classifyPyeong,
  estimateRoomDimsFromPyeong,
  getTotalArea,
  roomAreaM2,
  type PyungType,
} from "@/lib/inpick/korean-apt-dimensions";
import { analyzeImageVision } from "@/lib/inpick/openai-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, imageMimeType, exclusiveAreaM2 } = body;
    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: "imageUrl 또는 imageBase64 필요" }, { status: 400 });
    }

    // 1) Vision 분석 — 평면도에서 mm 치수 OCR + 실별 인식
    const visionPrompt = `이 평면도를 분석해서 다음 JSON으로만 응답:
{
  "exclusive_area_m2": 0,        // 전용면적 (mm 치수로 계산 또는 도면 표기)
  "rooms_detected": {            // 인식된 실 종류와 개수
    "거실": 1, "안방": 1, "침실": 2, "주방": 1, "욕실": 2, "발코니": 1
  },
  "room_dimensions_mm": {        // 가능한 실별 mm 치수 (도면에 표기된 경우)
    "거실": {"width": 5800, "depth": 4200},
    "안방": {"width": 4200, "depth": 3500}
  },
  "expansion_visible": false,    // 평면 확장 시공 여부
  "ceiling_height_mm": 2400,
  "confidence": 0.0
}
도면에 mm 치수가 명시 안 된 경우 room_dimensions_mm 는 빈 객체로 두고, exclusive_area_m2 만 추정.`;

    let visionResult: any = {};
    let source: "vision" | "standard_db" = "standard_db";
    try {
      const v = await analyzeImageVision({
        imageUrl, imageBase64, imageMimeType,
        prompt: visionPrompt,
        responseFormat: "json_object",
      });
      visionResult = JSON.parse(v.content);
      source = "vision";
    } catch (e) {
      // Vision 실패 시 표준 DB 만 사용
      visionResult = {};
    }

    // 2) 평형 결정 (사용자 입력 > Vision 추정 > 기본 30평)
    const areaM2 = exclusiveAreaM2 || visionResult.exclusive_area_m2 || 84;
    const pyeong: PyungType = classifyPyeong(areaM2);

    // 3) 표준 DB 로 실별 치수 채우기 + Vision 인식된 치수 우선 적용
    const baseDims = estimateRoomDimsFromPyeong(pyeong, visionResult.rooms_detected);
    const finalDims: Record<string, any> = {};
    for (const [name, dim] of Object.entries(baseDims)) {
      const visionDim = visionResult.room_dimensions_mm?.[name];
      finalDims[name] = {
        widthMm: visionDim?.width || dim.widthMm,
        depthMm: visionDim?.depth || dim.depthMm,
        heightMm: visionResult.ceiling_height_mm || dim.heightMm,
        areaM2: roomAreaM2({
          ...dim,
          widthMm: visionDim?.width || dim.widthMm,
          depthMm: visionDim?.depth || dim.depthMm,
        }),
        source: visionDim ? "vision_ocr" : "standard_db",
      };
    }

    return NextResponse.json({
      pyeong,
      exclusiveAreaM2: areaM2,
      rooms: finalDims,
      totalAreaM2: getTotalArea(pyeong),
      expansionVisible: visionResult.expansion_visible || false,
      ceilingHeightMm: visionResult.ceiling_height_mm || baseDims["거실"]?.heightMm || 2400,
      source,
      confidence: visionResult.confidence || 0.6,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
