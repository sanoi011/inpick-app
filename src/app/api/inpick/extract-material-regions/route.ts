/**
 * POST /api/inpick/extract-material-regions
 *
 * 1차 렌더 이미지(gpt-image-2) → GPT-5.6 Sol Vision → SegmentationData JSON
 * SAM 2.1 직접 운영 GPU 서버가 준비되면 그쪽으로 분기 추가 예정.
 *
 * 가이드 정책: Replicate / 외부 SaaS 일체 금지.
 *
 * 입력: { imageUrl, roomName?, realWorldAreaSqm? }
 * 출력: SegmentationData
 */
import { NextRequest, NextResponse } from "next/server";
import { gpt4oProvider } from "@/lib/inpick/segmentation/gpt4o-provider";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  roomName?: string;
  realWorldAreaSqm?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.imageUrl && !body.imageBase64) {
      return NextResponse.json({ error: "imageUrl 또는 imageBase64 필수" }, { status: 400 });
    }

    const data = await gpt4oProvider.segment({
      imageUrl: body.imageUrl || "",
      imageBase64: body.imageBase64,
      roomName: body.roomName,
      realWorldAreaSqm: body.realWorldAreaSqm,
    });

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint: string | undefined;
    if (msg.includes("JSON 파싱")) {
      hint = "이미지 분석 결과 처리 실패 — 잠시 후 재시도";
    } else {
      hint = "영역 분석 실패 (요금이 발생하지 않았습니다)";
    }
    console.warn("[extract-material-regions] failed:", msg);
    return NextResponse.json(
      { error: "자재 영역 분석에 실패했습니다", hint, tokenConsumed: false },
      { status: 502 },
    );
  }
}
