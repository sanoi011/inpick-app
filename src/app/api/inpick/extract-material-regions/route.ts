/**
 * POST /api/inpick/extract-material-regions
 *
 * 1차 렌더 이미지(DALL-E 3) → GPT-4o Vision → 자재별 폴리곤 영역 JSON
 * 사용자가 영역 클릭 → 자재 교체 → /refine-render inpaint 호출
 *
 * 입력: { imageUrl: string, roomName: string }
 * 출력: { regions: MaterialRegion[], imageWidth: number, imageHeight: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { analyzeImageVision } from "@/lib/inpick/openai-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface MaterialRegion {
  id: string;
  surface: string;          // "바닥" | "벽" | "천장" | "가구" | "조명" | "창호" | "도어"
  detail: string;           // "거실 바닥", "TV 뒷벽", "소파" 등
  material: string;         // "오크 원목마루", "월넛 가구"
  colorHex?: string;
  polygon: [number, number][]; // [[x, y], ...] — 0~1 정규화 좌표 (이미지 기준)
}

const PROMPT = `이미지는 한국 인테리어 렌더링입니다. 클릭 가능한 자재 영역을 추출하세요.

JSON 응답 (반드시 valid object):
{
  "imageWidth": 1024,
  "imageHeight": 1024,
  "regions": [
    {
      "id": "floor",
      "surface": "바닥|벽|천장|가구|조명|창호|도어|타일|몰딩",
      "detail": "구체적 설명 (예: 거실 바닥, TV 뒷벽, 소파, 다이닝 테이블)",
      "material": "추정 자재명 (예: 오크 원목마루, 화이트 페인트, 월넛 우드, 대리석)",
      "colorHex": "#RRGGBB",
      "polygon": [[0.12, 0.65], [0.88, 0.62], [0.92, 0.95], [0.08, 0.98]]
    }
  ]
}

규칙:
- polygon 좌표는 0~1 정규화 (이미지 left-top = (0,0), right-bottom = (1,1))
- 4~8개 꼭짓점으로 단순화. 곡면은 사각 근사 OK
- 큰 면적 면 우선: 바닥, 주벽 3면, 천장, 주요 가구 (소파/침대/테이블/싱크대)
- 작은 소품은 무시
- id는 영문 소문자 + 숫자 (예: "floor", "wall1", "sofa", "ceiling")
- 최대 10개 영역까지`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { imageUrl?: string; roomName?: string };
    if (!body.imageUrl) {
      return NextResponse.json({ error: "imageUrl 필수" }, { status: 400 });
    }

    const visionRes = await analyzeImageVision({
      imageUrl: body.imageUrl,
      prompt: PROMPT + (body.roomName ? `\n공간: ${body.roomName}` : ""),
      responseFormat: "json_object",
    });

    let parsed: { regions?: MaterialRegion[]; imageWidth?: number; imageHeight?: number };
    try {
      parsed = JSON.parse(visionRes.content);
    } catch {
      return NextResponse.json(
        { error: "Vision JSON 파싱 실패", raw: visionRes.content.slice(0, 500) },
        { status: 502 },
      );
    }

    const regions = (parsed.regions || []).filter(
      (r) => r.id && r.polygon && Array.isArray(r.polygon) && r.polygon.length >= 3,
    );

    return NextResponse.json({
      regions,
      imageWidth: parsed.imageWidth || 1024,
      imageHeight: parsed.imageHeight || 1024,
      regionCount: regions.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
