import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { uploadRenderImage } from "@/lib/inpick/storage/image-storage";

/**
 * POST /api/expo/print-upload — 인쇄물 참조 이미지 첨부 (로그인 필수).
 * 사용자는 첨부 자산의 사용 권한 보유를 전제로 한다 (§3.3).
 */

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BASE64_CHARS = 11_000_000; // ≈ 8MB 바이너리

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { imageBase64?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const raw = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const clean = raw.startsWith("data:") ? raw.split(",")[1] ?? "" : raw;
  if (!clean || clean.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: "IMAGE_INVALID" }, { status: 400 });
  }

  try {
    const png = await sharp(Buffer.from(clean, "base64"))
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const result = await uploadRenderImage(
      `data:image/png;base64,${png.toString("base64")}`,
      {
        jobId: `expo-print-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
        roomName: "print-ref",
        modelVersion: "upload",
      },
    );
    if (!result.url || !result.url.startsWith("http")) {
      throw new Error(result.error ?? "STORAGE_URL_MISSING");
    }
    return NextResponse.json({ url: result.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    console.error("[expo-print-upload] failed:", message);
    return NextResponse.json({ error: "UPLOAD_FAILED", message }, { status: 502 });
  }
}
