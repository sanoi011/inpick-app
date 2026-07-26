import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import {
  ImageInputError,
  uploadRenderImage,
} from "@/lib/inpick/storage/image-storage";
import { fetchSafe } from "@/lib/expo/server/safe-fetch";

/**
 * POST /api/expo/brand-logo-store — 확정 시점의 로고를 우리 스토리지로
 * 재호스팅한다. 외부 로고 URL은 CORS 때문에 3D 텍스처(데칼)로 쓸 수 없고,
 * 원본 사이트가 바뀌어도 확정된 킷은 보존돼야 한다 (§3.2 source 스냅샷).
 * 로그인 필수, SSRF 가드 통과 이미지만, PNG 512px로 정규화.
 */

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 5_000_000;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { logoUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
  if (!logoUrl || logoUrl.length > 2000) {
    return NextResponse.json({ error: "LOGO_URL_REQUIRED" }, { status: 400 });
  }

  try {
    const remote = await fetchSafe(logoUrl, "image/*", MAX_LOGO_BYTES);
    // ico 등 sharp 미지원 포맷은 여기서 실패 → 클라이언트는 원본 URL 유지
    const png = await sharp(remote.buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const result = await uploadRenderImage(
      `data:image/png;base64,${png.toString("base64")}`,
      {
        jobId: `expo-brand-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
        roomName: "brand-logo",
        modelVersion: "importer-v1",
      },
    );
    if (!result.url || !result.url.startsWith("http")) {
      throw new Error(result.error ?? "STORAGE_URL_MISSING");
    }
    return NextResponse.json({ hostedLogoUrl: result.url });
  } catch (cause) {
    if (cause instanceof ImageInputError) {
      return NextResponse.json({ error: "UNSAFE_URL" }, { status: 400 });
    }
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    console.error("[expo-brand-logo-store] failed:", message);
    return NextResponse.json({ error: "STORE_FAILED", message }, { status: 502 });
  }
}
