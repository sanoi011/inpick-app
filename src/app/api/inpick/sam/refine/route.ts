/**
 * POST /api/inpick/sam/refine
 *
 * 영역 미세 조정 — positive(포함할 점) + negative(제외할 점).
 * 가이드 §3-2 refine_selection 동등.
 *
 * 입력:
 *   {
 *     imageUrl: string,
 *     positive: [{x, y}, ...],
 *     negative: [{x, y}, ...]
 *   }
 *
 * 출력: click route와 동일 schema
 */
import { NextRequest, NextResponse } from "next/server";
import { samRefineSegment, isSamRunPodConfigured } from "@/lib/inpick/sam-runpod-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  positive?: { x: number; y: number }[];
  negative?: { x: number; y: number }[];
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

async function uploadMaskToStorage(maskB64: string): Promise<string | null> {
  try {
    const supa = createAdminClient();
    const buf = Buffer.from(maskB64, "base64");
    const fileName = `sam-masks/refine/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
    const { error } = await supa.storage
      .from("renders")
      .upload(fileName, buf, { contentType: "image/png", upsert: false });
    if (error) return null;
    const { data: pub } = supa.storage.from("renders").getPublicUrl(fileName);
    return pub.publicUrl;
  } catch {
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
    const positive = body.positive || [];
    const negative = body.negative || [];
    if (positive.length === 0) {
      return NextResponse.json({ error: "positive 점 1개 이상 필수" }, { status: 400 });
    }

    const imageB64 = body.imageBase64
      ? body.imageBase64.replace(/^data:.*;base64,/, "")
      : await fetchImageAsBase64(body.imageUrl!);

    const result = await samRefineSegment(imageB64, positive, negative);
    const maskUrl = await uploadMaskToStorage(result.mask_b64);

    return NextResponse.json({
      polygon: result.polygon,
      confidence: result.confidence,
      area_pixels: result.area_pixels,
      image_size: result.image_size,
      mask_url: maskUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[sam/refine] failed:", msg);
    return NextResponse.json(
      { error: "영역 조정에 실패했습니다", hint: "잠시 후 재시도" },
      { status: 502 },
    );
  }
}
