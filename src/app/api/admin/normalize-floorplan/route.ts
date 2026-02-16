import { NextRequest, NextResponse } from "next/server";
import { normalizeNaverFloorPlan } from "@/lib/services/naver-floorplan-normalizer";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

/**
 * POST /api/admin/normalize-floorplan
 *
 * 네이버 부동산 도면 이미지 → AI 레이아웃 인식 → 표준 면적 정규화
 *
 * Body (JSON):
 *   imageUrl: string (네이버 도면 이미지 URL)
 *   knownArea: number (전용면적 m²)
 *   complexNo?: string
 *   pyeongName?: string
 *
 * 또는 Body (FormData):
 *   file: File (도면 이미지)
 *   knownArea: string
 *   complexNo?: string
 *   pyeongName?: string
 */
export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    let imageBase64: string;
    let mimeType: string;
    let knownArea: number;
    let complexNo: string | undefined;
    let pyeongName: string | undefined;
    let sourceUrl: string | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // FormData 업로드
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      mimeType = file.type || "image/jpeg";
      knownArea = parseFloat(formData.get("knownArea") as string) || 84;
      complexNo = (formData.get("complexNo") as string) || undefined;
      pyeongName = (formData.get("pyeongName") as string) || undefined;
    } else {
      // JSON body (imageUrl로 이미지 다운로드)
      const body = await request.json();
      knownArea = body.knownArea || 84;
      complexNo = body.complexNo;
      pyeongName = body.pyeongName;
      sourceUrl = body.imageUrl;

      if (!body.imageUrl && !body.imageBase64) {
        return NextResponse.json({ error: "imageUrl or imageBase64 is required" }, { status: 400 });
      }

      if (body.imageBase64) {
        imageBase64 = body.imageBase64;
        mimeType = body.mimeType || "image/jpeg";
      } else {
        // URL에서 이미지 다운로드
        const imgRes = await fetch(body.imageUrl, { signal: AbortSignal.timeout(10000) });
        if (!imgRes.ok) {
          return NextResponse.json({ error: `Failed to fetch image: ${imgRes.status}` }, { status: 400 });
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        imageBase64 = buffer.toString("base64");
        mimeType = imgRes.headers.get("content-type") || "image/jpeg";
      }
    }

    const startTime = Date.now();
    const result = await normalizeNaverFloorPlan(
      imageBase64,
      mimeType,
      knownArea,
      GEMINI_API_KEY,
      { complexNo, pyeongName, sourceUrl },
    );

    if (!result) {
      return NextResponse.json({ error: "Failed to recognize layout" }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error("Normalize floorplan error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
