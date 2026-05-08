/**
 * POST /api/inpick/extract-material-regions
 *
 * 1차 렌더 이미지(gpt-image-2) → SAM 2.1 (또는 GPT-4o Vision) → SegmentationData JSON
 * 가이드 §1-4 build_segmentation_data 의 동등 구현.
 *
 * provider 분기:
 *   - process.env.SEGMENTATION_PROVIDER === "sam-2.1" → Replicate SAM 2 (REPLICATE_API_TOKEN 필요)
 *   - 그 외 → GPT-4o Vision (기본)
 *
 * 입력: { imageUrl, roomName?, realWorldAreaSqm? }
 * 출력: SegmentationData
 */
import { NextRequest, NextResponse } from "next/server";
import { pickProvider } from "@/lib/inpick/segmentation/provider";
import { gpt4oProvider } from "@/lib/inpick/segmentation/gpt4o-provider";
import { samReplicateProvider } from "@/lib/inpick/segmentation/sam-replicate-provider";

export const runtime = "nodejs";
export const maxDuration = 300; // SAM 2 cold start + classification 합쳐 최대 4분
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

    const choice = pickProvider();
    const provider = choice === "sam-2.1" ? samReplicateProvider : gpt4oProvider;

    const data = await provider.segment({
      imageUrl: body.imageUrl || "",
      imageBase64: body.imageBase64,
      roomName: body.roomName,
      realWorldAreaSqm: body.realWorldAreaSqm,
    });

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint: string | undefined;
    if (msg.includes("REPLICATE_API_TOKEN") || msg.includes("Replicate") || msg.includes("SAM")) {
      hint = "영역 분석 서비스 일시 장애 (관리자에게 문의)";
    } else if (msg.includes("JSON 파싱")) {
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
