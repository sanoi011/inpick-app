/**
 * GET /api/inpick/estimate-documents/[documentId]
 *
 * 견적서 단일 조회 — 인증된 consumer 또는 service_role만.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEstimateDocument } from "@/lib/inpick/estimate-documents/repository";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { documentId: string } },
) {
  const documentId = params.documentId;
  if (!documentId) return NextResponse.json({ error: "documentId 필수" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const doc = await getEstimateDocument(documentId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 권한 검증
  const isOwner = user?.id === doc.consumer_id;
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(doc);
}
