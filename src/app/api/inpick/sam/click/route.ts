/**
 * POST /api/inpick/sam/click
 *
 * 사용자가 이미지의 (x, y) 클릭 → SAM 2.1이 그 지점에 해당하는 영역 분할.
 * 가이드 InPick_RunPod_Serverless_Migration.md §3 select_by_click 동등.
 *
 * 입력:
 *   { imageUrl: string, x: number, y: number, imageWidth?: number, imageHeight?: number }
 *
 * 출력:
 *   { polygon, confidence, area_pixels, mask_url, image_size }
 *   mask_url = Supabase Storage public URL (자재 교체 시 재사용)
 */
import { NextRequest, NextResponse } from "next/server";
import { samClickSegment, isSamRunPodConfigured } from "@/lib/inpick/sam-runpod-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  x: number;
  y: number;
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

async function uploadMaskToStorage(maskB64: string, prefix: string): Promise<string | null> {
  try {
    const supa = createAdminClient();
    const buf = Buffer.from(maskB64, "base64");
    const fileName = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
    const { error } = await supa.storage
      .from("renders")
      .upload(fileName, buf, { contentType: "image/png", upsert: false });
    if (error) {
      console.warn("[sam/click] mask upload failed:", error.message);
      return null;
    }
    const { data: pub } = supa.storage.from("renders").getPublicUrl(fileName);
    return pub.publicUrl;
  } catch (e) {
    console.warn("[sam/click] storage exception:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!isSamRunPodConfigured()) {
    return NextResponse.json(
      {
        error: "영역 분할 서비스가 아직 활성화되지 않았습니다",
        hint: "관리자에게 RUNPOD_API_KEY / RUNPOD_SAM_ENDPOINT_ID 등록 요청",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as Body;
    if (!body.imageUrl && !body.imageBase64) {
      return NextResponse.json({ error: "imageUrl 또는 imageBase64 필수" }, { status: 400 });
    }
    if (typeof body.x !== "number" || typeof body.y !== "number") {
      return NextResponse.json({ error: "x, y 필수 (픽셀 좌표)" }, { status: 400 });
    }

    const imageB64 = body.imageBase64
      ? body.imageBase64.replace(/^data:.*;base64,/, "")
      : await fetchImageAsBase64(body.imageUrl!);

    const result = await samClickSegment(imageB64, body.x, body.y);

    // mask PNG를 Storage에 업로드 → URL 반환 (응답 body 작게 유지)
    const maskUrl = await uploadMaskToStorage(result.mask_b64, "sam-masks/click");

    // 가이드 v2 §5-2 — 모든 candidates도 Storage에 업로드 (mask_b64는 응답에서 제외)
    let candidatesOut:
      | { polygon: number[][]; confidence: number; area_pixels: number; mask_url: string | null }[]
      | undefined;
    if (result.candidates && result.candidates.length > 0) {
      candidatesOut = await Promise.all(
        result.candidates.map(async (c) => ({
          polygon: c.polygon,
          confidence: c.confidence,
          area_pixels: c.area_pixels,
          mask_url: await uploadMaskToStorage(c.mask_b64, "sam-masks/click-cand"),
        })),
      );
    }

    return NextResponse.json({
      polygon: result.polygon,
      confidence: result.confidence,
      area_pixels: result.area_pixels,
      image_size: result.image_size,
      mask_url: maskUrl,
      // mask_b64 그대로 반환은 안 함 — 용량 큼
      candidates: candidatesOut,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint: string | undefined;
    if (msg.includes("RUNPOD_API_KEY")) {
      hint = "영역 분할 서비스 환경 미설정 (관리자 문의)";
    } else if (msg.includes("timeout")) {
      hint = "분석 시간 초과 — 잠시 후 재시도";
    } else {
      hint = "영역 분할 실패";
    }
    console.warn("[sam/click] failed:", msg);
    return NextResponse.json(
      { error: "영역 분할에 실패했습니다", hint },
      { status: 502 },
    );
  }
}
