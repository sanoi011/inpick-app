/**
 * estimate_document_snapshots repository.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  EstimateDocumentPackage,
  EstimateDocumentSnapshotRow,
} from "./types";
import {
  createScopeHash,
  createEstimateHash,
  createMaterialHash,
} from "./snapshot-builder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export async function insertEstimateDocument(
  pkg: EstimateDocumentPackage,
  meta: {
    rfqId?: string;
    bidId?: string;
    contractId?: string;
    contractorId?: string;
    pdfUrl?: string;
    pdfStoragePath?: string;
    createdBy?: string;
  },
): Promise<{ id: string; documentNo: string } | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const scopeHash = createScopeHash(pkg.project);
  const estimateHash = createEstimateHash(pkg.lines);
  const materialHash = createMaterialHash(pkg.lines);

  const row: Partial<EstimateDocumentSnapshotRow> = {
    project_id: pkg.project.projectId,
    rfq_id: meta.rfqId,
    bid_id: meta.bidId,
    contract_id: meta.contractId,
    consumer_id: pkg.consumer.userId || pkg.project.consumerId,
    contractor_id: meta.contractorId,
    mode: pkg.mode,
    status: pkg.status,
    document_no: pkg.documentNo,
    version: pkg.version,
    title: pkg.mode === "matched_contract" ? "확정 견적서" : "공사 견적서",
    project_snapshot: pkg.project,
    consumer_snapshot: pkg.consumer,
    contractor_snapshot: pkg.contractor,
    inpick_snapshot: pkg.inpick,
    summary_snapshot: pkg.summary,
    trade_summary_snapshot: pkg.tradeSummaries,
    line_snapshot: pkg.lines,
    assumptions: pkg.assumptions,
    exclusions: pkg.exclusions,
    warnings: pkg.warnings,
    pdf_url: meta.pdfUrl,
    pdf_storage_path: meta.pdfStoragePath,
    scope_hash: scopeHash,
    estimate_hash: estimateHash,
    material_hash: materialHash,
    issued_at: pkg.issuedAt,
    valid_until: pkg.validUntil,
    created_by: meta.createdBy,
  };

  const { data, error } = await admin
    .from("estimate_document_snapshots")
    .insert(row)
    .select("id, document_no")
    .single();
  if (error || !data) {
    console.warn(
      `[estimate-doc/repo] insert error: ${error?.message || "unknown"}`,
    );
    return null;
  }
  return { id: (data as { id: string }).id, documentNo: (data as { document_no: string }).document_no };
}

export async function getEstimateDocument(
  documentId: string,
): Promise<EstimateDocumentSnapshotRow | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("estimate_document_snapshots")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as EstimateDocumentSnapshotRow;
}

export async function updateEstimateDocumentStatus(
  documentId: string,
  status: EstimateDocumentSnapshotRow["status"],
  pdfUrl?: string,
): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const patch: Record<string, unknown> = { status };
  if (pdfUrl) patch.pdf_url = pdfUrl;
  const { error } = await admin
    .from("estimate_document_snapshots")
    .update(patch)
    .eq("id", documentId);
  return !error;
}
