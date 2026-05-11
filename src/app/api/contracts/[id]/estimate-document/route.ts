/**
 * POST /api/contracts/[contractId]/estimate-document
 *
 * 계약 확정본 견적서 발행 (matched_contract mode).
 * 가이드: §9-4
 *
 * Input: { sourceBidEstimateDocumentId: string }
 *
 * Flow:
 *   1. contract 조회 → consumer_id, contractor_id
 *   2. source bid estimate document 조회
 *   3. mode="matched_contract" + 전체 정보 (소비자 unmasking)
 *   4. estimate_document_snapshots에 status="accepted"로 저장
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getEstimateDocument,
  insertEstimateDocument,
} from "@/lib/inpick/estimate-documents/repository";
import {
  resolveConsumerPartySnapshot,
  resolveContractorPartySnapshot,
  resolveInPickPartySnapshot,
} from "@/lib/inpick/estimate-documents/party-resolver";
import { buildEstimateDocumentPackage } from "@/lib/inpick/estimate-documents/snapshot-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } },
) {
  const contractId = params.contractId;
  if (!contractId) return NextResponse.json({ error: "contractId 필수" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { sourceBidEstimateDocumentId?: string };
  const sourceBidId = body.sourceBidEstimateDocumentId;

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

  // 2. source bid document (있으면) → 라인 재사용
  let sourceDoc: Awaited<ReturnType<typeof getEstimateDocument>> = null;
  if (sourceBidId) {
    sourceDoc = await getEstimateDocument(sourceBidId);
  }

  // 3. parties — matched_contract 모드 (전체 정보)
  const projectId = sourceDoc?.project_id || c.estimate_id || contractId;
  const [consumer, contractor] = await Promise.all([
    resolveConsumerPartySnapshot({ projectId, consumerId: c.consumer_id, mode: "matched_contract" }),
    resolveContractorPartySnapshot({ contractorId: c.contractor_id }),
  ]);
  const inpick = resolveInPickPartySnapshot();

  // 4. project scope — source doc에서 가져옴 (없으면 contract 기반 최소)
  const project = sourceDoc?.project_snapshot || {
    projectId,
    consumerId: c.consumer_id,
    contractId,
    projectName: `계약 ${contractId.slice(0, 8)}`,
    addressText: consumer.address || "",
    scopeSummary: "계약 확정 견적서",
  };

  // 5. build package — sourceDoc의 lines 재사용
  const pkg = buildEstimateDocumentPackage({
    projectId,
    contractId,
    contractorId: c.contractor_id,
    mode: "matched_contract",
    project: { ...project, contractId },
    consumer,
    contractor,
    inpick,
    buildEstimateResult: sourceDoc
      ? {
          estimates: sourceDoc.line_snapshot.map((l) => ({
            roomName: l.roomName || "공사 전체",
            items: [
              {
                surface: l.tradeName,
                materialName: l.itemName,
                brand: l.brand,
                spec: l.spec,
                sku: l.sku,
                quantity: l.quantity,
                unit: l.unit,
                unitPriceWon: l.materialUnitPrice || l.laborUnitPrice || 0,
                subtotalWon: l.totalAmount,
                category: l.materialAmount ? ("main" as const) : ("labor" as const),
                priceSource: l.priceSource,
              },
            ],
          })),
          grandTotal: {
            mainTotal: sourceDoc.summary_snapshot.materialAmount,
            auxTotal: 0,
            laborTotal: sourceDoc.summary_snapshot.laborAmount,
            totalWon: sourceDoc.summary_snapshot.totalAmount,
          },
        }
      : undefined,
  });

  // status = accepted (계약 확정)
  pkg.status = "accepted";

  // 6. DB insert
  const inserted = await insertEstimateDocument(pkg, {
    contractId,
    contractorId: c.contractor_id,
  });
  if (!inserted) {
    return NextResponse.json(
      { error: "DOCUMENT_INSERT_FAILED", package: pkg },
      { status: 500 },
    );
  }

  return NextResponse.json({
    documentId: inserted.id,
    documentNo: inserted.documentNo,
    mode: "matched_contract",
    status: "accepted",
    package: pkg,
  });
}
