import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const contractorId = formData.get("contractorId") as string | null;
    const folder = (formData.get("folder") as string) || "documents";

    if (!file || !contractorId) {
      return NextResponse.json({ error: "file, contractorId 필수" }, { status: 400 });
    }

    const ALLOWED_FOLDERS = ["documents", "portfolio", "samples", "phases"];
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: "허용되지 않는 폴더입니다." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. (${ALLOWED_TYPES.join(", ")})` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 5MB를 초과합니다." },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Generate unique filename with sanitized extension
    const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "pdf"];
    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = ALLOWED_EXTS.includes(rawExt) ? rawExt : "jpg";
    const timestamp = Date.now();
    const path = `contractors/${contractorId}/${folder}/${timestamp}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, try creating it
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        // Bucket may not exist yet - return informative error
        return NextResponse.json(
          { error: "스토리지 버킷이 설정되지 않았습니다. Supabase 대시보드에서 'uploads' 버킷을 생성하세요." },
          { status: 500 }
        );
      }
      console.error("Upload error:", uploadError.message);
      return NextResponse.json({ error: "파일 업로드에 실패했습니다" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("uploads")
      .getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
