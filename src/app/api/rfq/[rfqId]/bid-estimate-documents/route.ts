/**
 * POST /api/rfq/[rfqId]/bid-estimate-documents
 *
 * 사업자 입찰 견적서 발행.
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §9-2
 *
 * Input:
 *   contractorId, bidId?, priceOverrides?, constructionDays?, specialNotes?
 *
 * Flow:
 *   1. RFQ → projectId 조회
 *   2. mode="contractor_bid" + 마스킹된 consumer + 사업자 정보
 *   3. priceOverrides 적용 (line별 단가 조정)
 *   4. estimate_document_snapshots에 저장 (status="draft")
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  resolveConsumerPartySnapshot,
  resolveContractorPartySnapshot,
  resolveInPickPartySnapshot,
} from "@/lib/inpick/estimate-documents/party-resolver";
import { buildEstimateDocumentPackage } from "@/lib/inpick/estimate-documents/snapshot-builder";
import { insertEstimateDocument } from "@/lib/inpick/estimate-documents/repository";
import type { ProjectScopeSnapshot, BidPriceOverrides } from "@/lib/inpick/estimate-documents/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface BodyInput {
  contractorId: string;
  bidId?: string;
  /** /api/inpick/build-estimate 결과 (소비자 견적 기준) */
  buildEstimateResult?: Parameters<typeof buildEstimateDocumentPackage>[0]["buildEstimateResult"];
  priceOverrides?: BidPriceOverrides;
  constructionDays?: number;
  specialNotes?: string;
}

export async function POST(req: NextRequest, { params }: { params: { rfqId: string } }) {
  const rfqId = params.rfqId;
  if (!rfqId) return NextResponse.json({ error: "rfqId 필수" }, { status: 400 });

  let body: BodyInput;
  try {
    body = (await req.json()) as BodyInput;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
  }
  if (!body.contractorId) return NextResponse.json({ error: "contractorId 필수" }, { status: 400 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase 미설정" }, { status: 503 });

  // 1. RFQ → projectId
  const { data: rfq } = await admin
    .from("estimates")
    .select("id, user_id, consumer_project_id, rfq_data")
    .eq("id", rfqId)
    .maybeSingle();
  if (!rfq) return NextResponse.json({ error: "RFQ 없음" }, { status: 404 });

  const projectId = (rfq as { consumer_project_id?: string }).consumer_project_id || rfqId;
  const consumerId = (rfq as { user_id?: string }).user_id || "";
  if (!consumerId) {
    return NextResponse.json(
      { error: "RFQ에 consumer_id 없음", hint: "estimates.user_id 확인" },
      { status: 400 },
    );
  }

  // 2. parties
  const [consumer, contractor] = await Promise.all([
    resolveConsumerPartySnapshot({ projectId, consumerId, mode: "contractor_bid" }),
    resolveContractorPartySnapshot({ contractorId: body.contractorId }),
  ]);
  const inpick = resolveInPickPartySnapshot();

  // 3. project scope
  const rfqData = ((rfq as { rfq_data?: Record<string, unknown> }).rfq_data || {}) as Record<string, unknown>;
  const project: ProjectScopeSnapshot = {
    projectId,
    consumerId,
    rfqId,
    bidId: body.bidId,
    projectName: (rfqData.projectName as string) || `RFQ-${rfqId.slice(0, 8)}`,
    addressText: (rfqData.address as string) || consumer.address || "",
    addressMaskedText: (rfqData.addressMasked as string),
    exclusiveAreaM2: rfqData.exclusiveAreaM2 as number | undefined,
    totalAreaM2: rfqData.totalAreaM2 as number | undefined,
    expansionOption: rfqData.expansionOption as "basic" | "expanded" | "mixed" | "unknown" | undefined,
    scopeSummary: (rfqData.scopeSummary as string) ||
      "사업자 입찰 견적 — 17공종 + 사업자 단가 조정",
  };

  // 4. build package
  let pkg = buildEstimateDocumentPackage({
    projectId,
    rfqId,
    bidId: body.bidId,
    contractorId: body.contractorId,
    mode: "contractor_bid",
    project,
    consumer,
    contractor,
    inpick,
    buildEstimateResult: body.buildEstimateResult,
    bidOverrides: body.priceOverrides,
  });

  // 5. priceOverrides 적용 (간단 — line별 단가 덮어쓰기)
  if (body.priceOverrides?.lineOverrides && body.priceOverrides.lineOverrides.length > 0) {
    const overrideMap = new Map(body.priceOverrides.lineOverrides.map((o) => [o.lineId, o]));
    pkg.lines = pkg.lines.map((line) => {
      const ov = overrideMap.get(line.id);
      if (!ov) return line;
      const newLine = { ...line };
      if (typeof ov.materialUnitPrice === "number") {
        newLine.materialUnitPrice = ov.materialUnitPrice;
        newLine.materialAmount = ov.materialUnitPrice * line.quantity;
      }
      if (typeof ov.laborUnitPrice === "number") {
        newLine.laborUnitPrice = ov.laborUnitPrice;
        newLine.laborAmount = ov.laborUnitPrice * line.quantity;
      }
      if (typeof ov.expenseUnitPrice === "number") {
        newLine.expenseUnitPrice = ov.expenseUnitPrice;
        newLine.expenseAmount = ov.expenseUnitPrice * line.quantity;
      }
      newLine.totalAmount =
        (newLine.materialAmount || 0) + (newLine.laborAmount || 0) + (newLine.expenseAmount || 0);
      if (ov.memo) newLine.notes = ov.memo;
      return newLine;
    });
    // re-aggregate trade summaries + summary
    // (간단 — 호출자가 build-estimate 다시 호출하는 게 정석. 여기서는 lines만 갱신)
  }

  // assumptions에 추가
  if (body.constructionDays) {
    pkg.assumptions.push(`예상 공사기간: ${body.constructionDays}일`);
  }
  if (body.specialNotes) {
    pkg.assumptions.push(`특기사항: ${body.specialNotes}`);
  }

  // 6. DB insert
  const inserted = await insertEstimateDocument(pkg, {
    rfqId,
    bidId: body.bidId,
    contractorId: body.contractorId,
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
    mode: "contractor_bid",
    status: "draft",
    totalAmount: pkg.summary.totalAmount,
    package: pkg,
  });
}
