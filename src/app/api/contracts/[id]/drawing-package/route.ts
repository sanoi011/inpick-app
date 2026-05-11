/**
 * POST /api/contracts/[contractId]/drawing-package
 *
 * 계약 후 입면전개도 패키지 생성.
 * 가이드: §14-1
 *
 * Input: { estimateDocumentId: string }
 *
 * Flow:
 *   1. contract + estimate_document_snapshots 조회
 *   2. generateElevationDrawingSet → spec
 *   3. construction_drawing_sets + construction_drawings 저장
 *   4. drawingSetId 반환
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEstimateDocument } from "@/lib/inpick/estimate-documents/repository";
import {
  generateElevationDrawingSet,
  renderElevationSvgs,
} from "@/lib/inpick/drawings/drawing-package-generator";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest, { params }: { params: { contractId: string } }) {
  const contractId = params.contractId;
  if (!contractId) return NextResponse.json({ error: "contractId 필수" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { estimateDocumentId?: string };
  if (!body.estimateDocumentId) {
    return NextResponse.json({ error: "estimateDocumentId 필수" }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  // 1. contract
  const { data: contract } = await admin
    .from("contracts")
    .select("id, consumer_id, contractor_id, estimate_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "계약 없음" }, { status: 404 });
  const c = contract as { id: string; consumer_id: string; contractor_id: string; estimate_id?: string };

  // 2. estimate document
  const estimateDoc = await getEstimateDocument(body.estimateDocumentId);
  if (!estimateDoc) {
    return NextResponse.json({ error: "estimate document 없음" }, { status: 404 });
  }

  // 3. generate spec
  const spec = generateElevationDrawingSet({
    projectId: estimateDoc.project_id,
    contractId,
    contractorId: c.contractor_id,
    estimateDocument: estimateDoc,
  });

  // 4. SVG 생성
  const svgs = renderElevationSvgs(spec);

  // 5. construction_drawing_sets insert
  const { data: setRow, error: setErr } = await admin
    .from("construction_drawing_sets")
    .insert({
      project_id: estimateDoc.project_id,
      contract_id: contractId,
      contractor_id: c.contractor_id,
      source_estimate_document_id: estimateDoc.id,
      source_scope_hash: spec.scopeHash,
      source_floorplan_hash: spec.floorPlanHash,
      source_material_hash: spec.materialHash,
      drawing_package_type: "contractor_elevation_package",
      visibility: "matched_contractor_only",
      quality_status: "generated",
      revision: 1,
    })
    .select("id")
    .single();
  if (setErr || !setRow) {
    return NextResponse.json(
      { error: "drawing_set insert 실패", detail: setErr?.message },
      { status: 500 },
    );
  }
  const drawingSetId = (setRow as { id: string }).id;

  // 6. construction_drawings 일괄 insert (각 wall = 1 drawing)
  const drawingRows = svgs.map((s, idx) => {
    const wall = spec.walls[idx];
    return {
      drawing_set_id: drawingSetId,
      project_id: estimateDoc.project_id,
      contract_id: contractId,
      drawing_no: `D-${String(idx + 1).padStart(3, "0")}`,
      title: `${s.roomName} — Wall ${s.wallLabel}`,
      room_id: wall.roomId,
      room_name: s.roomName,
      wall_id: wall.wallId,
      drawing_kind: "elevation",
      svg_url: `data:image/svg+xml;utf8,${encodeURIComponent(s.svg)}`, // 출시 후 Supabase Storage 업로드 권장
      pdf_url: null,
      source_geometry_hash: spec.floorPlanHash,
      confidence: wall.confidence,
      warnings: wall.warnings,
    };
  });
  if (drawingRows.length > 0) {
    await admin.from("construction_drawings").insert(drawingRows);
  }

  return NextResponse.json({
    drawingSetId,
    drawingCount: drawingRows.length,
    warnings: spec.warnings,
    scopeHash: spec.scopeHash,
    /** 출시 후 PDF 묶음 URL 활성. 현재는 SVG inline. */
    pdfUrl: null,
  });
}

/**
 * GET /api/contracts/[contractId]/drawing-package/status
 * (별도 route.ts 또는 query로 처리 — 여기서는 GET 메서드 추가)
 */
export async function GET(_req: NextRequest, { params }: { params: { contractId: string } }) {
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  const { data: set } = await admin
    .from("construction_drawing_sets")
    .select("id, source_scope_hash, source_floorplan_hash, source_material_hash, quality_status, revision, created_at")
    .eq("contract_id", params.contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set) {
    return NextResponse.json({ status: "missing", needsRegeneration: true });
  }
  return NextResponse.json({
    drawingSetId: (set as { id: string }).id,
    status: (set as { quality_status?: string }).quality_status || "ready",
    needsRegeneration: false,
    revision: (set as { revision?: number }).revision,
    createdAt: (set as { created_at?: string }).created_at,
  });
}
