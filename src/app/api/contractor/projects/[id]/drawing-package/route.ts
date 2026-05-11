/**
 * GET /api/contractor/projects/[id]/drawing-package
 *
 * 사업자 프로젝트 도면 패키지 조회.
 * 가이드: §14-2
 *
 * 권한: contract.contractor_id === currentContractorId
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const contractorProjectId = params.id;
  const contractorId = getContractorIdFromRequest(req);
  if (!contractorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  // 1. contractor_projects → contract_id 확인 + 권한
  const { data: project } = await admin
    .from("contractor_projects")
    .select("id, contractor_id, contract_id")
    .eq("id", contractorProjectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });
  const p = project as { id: string; contractor_id: string; contract_id?: string };
  if (p.contractor_id !== contractorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!p.contract_id) {
    return NextResponse.json({ error: "계약 미확정", hint: "drawing-package는 계약 후 활성화" }, { status: 400 });
  }

  // 2. drawing_set 조회
  const { data: set } = await admin
    .from("construction_drawing_sets")
    .select("id, source_estimate_document_id, source_scope_hash, source_floorplan_hash, source_material_hash, visibility, quality_status, revision")
    .eq("contract_id", p.contract_id)
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set) {
    return NextResponse.json(
      { error: "drawing package 미생성", hint: "POST /api/contracts/[contractId]/drawing-package 호출 필요" },
      { status: 404 },
    );
  }
  const s = set as { id: string; visibility?: string };

  // 권한 — visibility 검증
  if (s.visibility && s.visibility !== "matched_contractor_only") {
    return NextResponse.json({ error: "Forbidden — visibility 정책" }, { status: 403 });
  }

  // 3. drawings 조회
  const { data: drawings } = await admin
    .from("construction_drawings")
    .select("id, drawing_no, title, room_id, room_name, wall_id, drawing_kind, svg_url, pdf_url, confidence, warnings")
    .eq("drawing_set_id", s.id)
    .order("drawing_no");

  return NextResponse.json({
    drawingSetId: s.id,
    projectId: p.id,
    contractId: p.contract_id,
    drawings: (drawings || []).map((d: Record<string, unknown>) => ({
      id: d.id,
      drawingNo: d.drawing_no,
      title: d.title,
      roomName: d.room_name,
      wallLabel: (d.wall_id as string | undefined)?.split("_").pop(),
      drawingKind: d.drawing_kind,
      svgUrl: d.svg_url,
      pdfUrl: d.pdf_url,
      confidence: d.confidence,
      warnings: d.warnings,
    })),
  });
}
