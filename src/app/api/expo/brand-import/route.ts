import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import {
  ImageInputError,
  assertSafeRemoteImageUrl,
} from "@/lib/inpick/storage/image-storage";
import { extractBrandCandidates } from "@/lib/expo/brand-import";

/**
 * POST /api/expo/brand-import — 참고 웹사이트에서 브랜드 "후보" 추출.
 *
 * 후보는 자동 확정되지 않는다 (블루프린트 §3.2) — 확정은 클라이언트에서
 * 사용자의 선택 + 사용 권한 확인으로만 이뤄진다. 로그인 필수(무료) —
 * 서버를 열린 프록시로 쓰는 것을 막는다. 모든 원격 URL은 SSRF 가드
 * (https 전용·사설망 차단)를 리다이렉트 단계마다 통과해야 한다.
 */

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 1_000_000;
const MAX_LOGO_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

async function fetchSafe(
  startUrl: string,
  accept: string,
  maxBytes: number,
): Promise<{ buffer: Buffer; finalUrl: string; contentType: string }> {
  let current = (await assertSafeRemoteImageUrl(startUrl)).toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { Accept: accept, "User-Agent": "INPICK-EXPO-BrandImporter/1.0" },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("REDIRECT_WITHOUT_LOCATION");
        // 리다이렉트 대상도 동일한 SSRF 가드를 통과해야 한다
        current = (
          await assertSafeRemoteImageUrl(new URL(location, current).toString())
        ).toString();
        continue;
      }
      if (!response.ok) throw new Error(`FETCH_${response.status}`);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > maxBytes) throw new Error("RESPONSE_TOO_LARGE");
      if (!response.body) throw new Error("EMPTY_RESPONSE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("RESPONSE_TOO_LARGE");
        }
        chunks.push(value);
      }
      return {
        buffer: Buffer.concat(chunks),
        finalUrl: current,
        contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("TOO_MANY_REDIRECTS");
}

/** 로고 이미지 대표색 → #rrggbb (실패 시 null — 후보가 없어도 실패 아님) */
async function dominantHexFromLogo(logoUrl: string): Promise<string | null> {
  try {
    const { buffer, contentType } = await fetchSafe(
      logoUrl,
      "image/*",
      MAX_LOGO_BYTES,
    );
    if (!contentType.startsWith("image/")) return null;
    const stats = await sharp(buffer).stats();
    const [r, g, b] = stats.channels;
    if (!r || !g || !b) return null;
    const hex = [r.mean, g.mean, b.mean]
      .map((mean) => Math.round(mean).toString(16).padStart(2, "0"))
      .join("");
    return `#${hex}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl || rawUrl.length > 500) {
    return NextResponse.json({ error: "URL_REQUIRED" }, { status: 400 });
  }
  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  try {
    const page = await fetchSafe(
      targetUrl,
      "text/html,application/xhtml+xml",
      MAX_HTML_BYTES,
    );
    if (!page.contentType.includes("text/html")) {
      return NextResponse.json({ error: "NOT_HTML" }, { status: 422 });
    }
    const candidates = extractBrandCandidates(
      page.buffer.toString("utf8"),
      page.finalUrl,
      new Date().toISOString(),
    );

    // 첫 로고에서 대표색 1개 추가 (theme-color 후보 뒤에)
    if (candidates.logoCandidates.length > 0) {
      const dominant = await dominantHexFromLogo(candidates.logoCandidates[0]);
      if (dominant && !candidates.colorCandidates.includes(dominant)) {
        candidates.colorCandidates = [
          ...candidates.colorCandidates,
          dominant,
        ].slice(0, 6);
      }
    }

    return NextResponse.json({ candidates });
  } catch (cause) {
    if (cause instanceof ImageInputError) {
      return NextResponse.json({ error: "UNSAFE_URL" }, { status: 400 });
    }
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    console.error("[expo-brand-import] failed:", message);
    return NextResponse.json(
      { error: "IMPORT_FAILED", message },
      { status: 502 },
    );
  }
}
