/**
 * POST /api/project/design-ai-image
 *
 * 4컷 방별 디자인 미리보기 (거실/부엌/침실/욕실) 일괄 생성.
 *
 * 변경 (2026-05-10): Gemini 이미지 생성 사용 중지 (대표 정책).
 * 가이드: docs/ops/GEMINI_REMOVAL_AUDIT.md Phase C/D
 *
 * 현재 상태: graceful degrade — 빈 응답 + 안내.
 *   호출자(design page Tab 2)는 빈 images 배열을 받아도 워크플로우 진행 가능.
 *
 * 후속 작업: 4컷을 /api/inpick/render-room (OpenAI gpt-image-2) 4회 호출로 통합.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const ROOMS_TO_RENDER = [
  { key: "living", label: "거실" },
  { key: "kitchen", label: "부엌" },
  { key: "bedroom", label: "침실" },
  { key: "bathroom", label: "욕실" },
] as const;

export async function POST(request: NextRequest) {
  // 호환을 위해 body는 받되 사용 안 함 (graceful response)
  try {
    await request.json();
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    images: ROOMS_TO_RENDER.map((r) => ({
      room: r.key,
      label: r.label,
      imageData: null,
      description:
        "4컷 일괄 미리보기는 현재 비활성화되어 있습니다. " +
        "Step2 디자이너에서 방별로 직접 이미지 생성을 사용해주세요.",
    })),
    notice:
      "이 엔드포인트는 Gemini 의존성 제거로 graceful degrade됨. " +
      "후속 작업에서 OpenAI gpt-image-2 (render-room) 통합 예정.",
    deprecated: true,
  });
}
