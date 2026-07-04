/**
 * POST /api/community/upload — 커뮤니티 게시글 이미지 업로드.
 * multipart/form-data (file) → Storage 'uploads' 버킷 community/{userId}/ 경로 → 공개 URL 반환.
 * 게시글당 첨부 개수 제한은 클라이언트+posts POST에서 검증.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "INVALID_TYPE", hint: "jpg/png/webp/gif만 가능" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", hint: "8MB 이하" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const path = `community/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from("uploads").upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    console.error("[community/upload] failed:", upErr);
    return NextResponse.json({ error: "UPLOAD_FAILED", hint: upErr.message }, { status: 500 });
  }
  const { data: pub } = admin.storage.from("uploads").getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, storagePath: path });
}
