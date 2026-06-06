/**
 * POST /api/inpick/sam/auto-segment
 *
 * 이미지 전체 자동 분할. 가이드 §3-1 / §4 백그라운드 자동 분할 동등.
 * 보통 이미지 생성 직후 백그라운드 트리거 → 사용자가 자재 모달 열 때 이미 준비.
 *
 * 입력:  { imageUrl: string, realWorldAreaSqm?: number }
 * 출력:  { regions: [...], image_size, pixel_to_sqm_ratio? }
 *        regions의 mask_b64는 UI 부담 줄이려 응답에 미포함, 대신 mask_url 제공
 */
import { NextRequest, NextResponse } from "next/server";
import { samAutoSegment, isSamRunPodConfigured } from "@/lib/inpick/sam-runpod-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  imageUrl?: string;
  imageBase64?: string;
  realWorldAreaSqm?: number;
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

async function uploadMaskToStorage(maskB64: string, idx: number): Promise<string | null> {
  try {
    const supa = createAdminClient();
    const buf = Buffer.from(maskB64, "base64");
    const fileName = `sam-masks/auto/${Date.now()}_${idx}.png`;
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

    const imageB64 = body.imageBase64
      ? body.imageBase64.replace(/^data:.*;base64,/, "")
      : await fetchImageAsBase64(body.imageUrl!);

    const result = await samAutoSegment(imageB64);

    // 각 region의 mask를 Storage에 병렬 업로드 (동시성 5)
    const regions = result.regions;
    const concurrency = 5;
    const out: Array<{
      id: string;
      polygon: number[][];
      bbox: number[];
      area_pixels: number;
      mask_url: string | null;
    }> = [];
    for (let i = 0; i < regions.length; i += concurrency) {
      const slice = regions.slice(i, i + concurrency);
      const urls = await Promise.all(
        slice.map((r, j) => uploadMaskToStorage(r.mask_b64, i + j)),
      );
      slice.forEach((r, j) => {
        out.push({
          id: r.id,
          polygon: r.polygon,
          bbox: r.bbox,
          area_pixels: r.area_pixels,
          mask_url: urls[j],
        });
      });
    }

    // pixel→sqm 비율 계산 (시공 가능 영역만 합산하기엔 카테고리 분류가 별도라 — 여기선 단순 총합)
    let pixel_to_sqm_ratio: number | undefined;
    if (body.realWorldAreaSqm && body.realWorldAreaSqm > 0) {
      const totalPx = out.reduce((s, r) => s + r.area_pixels, 0);
      if (totalPx > 0) pixel_to_sqm_ratio = body.realWorldAreaSqm / totalPx;
    }

    return NextResponse.json({
      regions: out,
      image_size: result.image_size,
      pixel_to_sqm_ratio,
      total_regions: out.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint: string | undefined;
    if (msg.includes("RUNPOD_API_KEY")) {
      hint = "영역 분할 서비스 환경 미설정 (관리자 문의)";
    } else if (msg.includes("timeout")) {
      hint = "자동 분할 시간 초과 — 클릭 기반 수동 선택 사용 권장";
    } else {
      hint = "자동 분할 실패";
    }
    console.warn("[sam/auto-segment] failed:", msg);
    return NextResponse.json(
      { error: "자동 영역 분할에 실패했습니다", hint },
      { status: 502 },
    );
  }
}
