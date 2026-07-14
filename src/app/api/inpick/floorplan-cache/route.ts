/**
 * POST /api/inpick/floorplan-cache
 *
 * 네이버 부동산 평면도 URL → Supabase Storage 'floorplans' bucket으로 1회 업로드,
 * public URL 반환. 동일 URL은 SHA-256 해시 기반 파일명으로 cache hit.
 *
 * 목적:
 *   1. 네이버 CDN 의존도 제거 (사이트 규약 + 차단 위험)
 *   2. 동일 단지 평형 이미지를 모든 사용자에게 빠르게 (Supabase CDN 캐시)
 *   3. gpt-image-2 edits API의 image input으로 이 URL을 그대로 사용 가능
 *
 * 입력: { sourceUrl: string }
 * 출력: { url: string, cached: boolean, sizeBytes: number }
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFloorplanBucketExists } from "@/lib/inpick/floorplan-storage";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const BUCKET = "floorplans";

interface Body {
  sourceUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const sourceUrl = body.sourceUrl?.trim();
    if (!sourceUrl) {
      return NextResponse.json({ error: "sourceUrl 필수" }, { status: 400 });
    }
    if (!/^https?:\/\//.test(sourceUrl)) {
      return NextResponse.json({ error: "유효하지 않은 URL" }, { status: 400 });
    }

    await ensureFloorplanBucketExists();
    const supa = createAdminClient();

    // SHA-256 해시 — 동일 URL은 한 번만 저장
    const hash = crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24);
    // 확장자는 source URL에서 추정, 없으면 png
    const ext = (sourceUrl.match(/\.(png|jpg|jpeg|webp)(\?|$)/i)?.[1] || "png").toLowerCase();
    const fileName = `naver/${hash}.${ext}`;

    // 1) 이미 업로드됐는지 확인
    const { data: pubExisting } = supa.storage.from(BUCKET).getPublicUrl(fileName);
    if (pubExisting?.publicUrl) {
      // public URL이 실제로 유효한지 HEAD 검증
      try {
        const head = await fetch(pubExisting.publicUrl, { method: "HEAD" });
        if (head.ok && (head.headers.get("content-length") || "1") !== "0") {
          return NextResponse.json({
            url: pubExisting.publicUrl,
            cached: true,
            sizeBytes: parseInt(head.headers.get("content-length") || "0", 10),
          });
        }
      } catch {
        /* HEAD 실패 — 새로 업로드 진행 */
      }
    }

    // 2) 네이버 CDN에서 fetch (브라우저 헤더 모방)
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    let imgBuf: Buffer;
    let contentType = "image/png";
    try {
      const imgRes = await fetch(sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://new.land.naver.com/",
        },
        signal: ctrl.signal,
      });
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `네이버 이미지 다운로드 실패: ${imgRes.status}` },
          { status: 502 },
        );
      }
      imgBuf = Buffer.from(await imgRes.arrayBuffer());
      contentType = imgRes.headers.get("content-type") || contentType;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "네이버 이미지 다운로드 실패", detail: msg.slice(0, 200) },
        { status: 502 },
      );
    } finally {
      clearTimeout(t);
    }

    if (imgBuf.length === 0) {
      return NextResponse.json({ error: "빈 이미지" }, { status: 502 });
    }

    // 3) Supabase Storage에 업로드 (upsert: true — 중복 방지)
    const { error: uploadErr } = await supa.storage
      .from(BUCKET)
      .upload(fileName, imgBuf, { contentType, upsert: true });
    if (uploadErr) {
      console.warn("[floorplan-cache] upload failed:", uploadErr.message);
      // Storage 버킷이 아직 배포되지 않았어도 네이버 원본 도면 수신 자체는 성공이다.
      // 캐시는 건너뛰고 원본 URL을 반환해 이후 AI 분석과 사용자 진행을 막지 않는다.
      if (uploadErr.message.toLowerCase().includes("bucket not found")) {
        return NextResponse.json({
          url: sourceUrl,
          cached: false,
          sizeBytes: imgBuf.length,
          storageSkipped: true,
        });
      }
      return NextResponse.json(
        { error: "Storage 업로드 실패", detail: uploadErr.message.slice(0, 200) },
        { status: 502 },
      );
    }

    const { data: pub } = supa.storage.from(BUCKET).getPublicUrl(fileName);
    return NextResponse.json({
      url: pub.publicUrl,
      cached: false,
      sizeBytes: imgBuf.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[floorplan-cache] error:", msg);
    return NextResponse.json(
      { error: "평면도 캐시 실패", detail: msg.slice(0, 200) },
      { status: 500 },
    );
  }
}
