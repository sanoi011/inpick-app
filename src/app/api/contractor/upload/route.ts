import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_FOLDERS = ["documents", "portfolio", "samples", "phases"];
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "pdf"];

export async function POST(req: NextRequest) {
  const authContractorId = getContractorIdFromRequest(req);
  if (!authContractorId) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const contractorId = formData.get("contractorId") as string | null;
    const folder = (formData.get("folder") as string) || "documents";

    if (!file || !contractorId) {
      return NextResponse.json({ error: "file, contractorId 필수" }, { status: 400 });
    }
    if (contractorId !== authContractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: "허용되지 않는 폴더입니다." }, { status: 400 });
    }
    if (folder === "documents") {
      return NextResponse.json(
        { error: "보호 문서 스토리지 연결 후 업로드할 수 있습니다." },
        { status: 503 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. (${ALLOWED_TYPES.join(", ")})` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기가 5MB를 초과합니다." }, { status: 400 });
    }

    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = ALLOWED_EXTS.includes(rawExt) ? rawExt : "jpg";
    const path = `contractors/${contractorId}/${folder}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        return NextResponse.json(
          { error: "스토리지 버킷이 설정되지 않았습니다. Supabase 대시보드에서 'uploads' 버킷을 생성하세요." },
          { status: 500 },
        );
      }
      console.error("Upload error:", uploadError.message);
      return NextResponse.json({ error: "파일 업로드에 실패했습니다" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
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
