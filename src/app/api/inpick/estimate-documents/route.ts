/**
 * POST /api/inpick/estimate-documents
 *
 * 가이드: c:\Users\user\Downloads\inpick-construction-estimate-drawing-package-plan-20260511.md §9
 *
 * 책임:
 *   - mode (consumer_preview / contractor_bid / matched_contract) 별 견적서 발행
 *   - build-estimate 결과 + party snapshot → EstimateDocumentPackage
 *   - estimate_document_snapshots에 저장
 *   - PDF는 server-side renderer 또는 클라 측에서 jsPDF (현재 client-side)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  resolveConsumerPartySnapshot,
  resolveContractorPartySnapshot,
  resolveInPickPartySnapshot,
} from "@/lib/inpick/estimate-documents/party-resolver";
import { buildEstimateDocumentPackage } from "@/lib/inpick/estimate-documents/snapshot-builder";
import { insertEstimateDocument } from "@/lib/inpick/estimate-documents/repository";
import type {
  EstimateDocumentMode,
  ProjectScopeSnapshot,
} from "@/lib/inpick/estimate-documents/types";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  hasEstimateBundleAccess,
  normalizeEstimateAccessId,
} from "@/lib/inpick/estimate-bundle-access";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface BodyInput {
  projectId: string;
  /** Step3 세부견적과 통합 문서에 공통으로 묶인 견적 버전 접근 키 */
  accessId?: string;
  mode?: EstimateDocumentMode;
  rfqId?: string;
  bidId?: string;
  contractId?: string;
  contractorId?: string;
  /** build-estimate 응답 직접 전달 (호출자가 합쳐서 전송) */
  buildEstimateResult?: Parameters<typeof buildEstimateDocumentPackage>[0]["buildEstimateResult"];
  // P13-1: v2 ConstructionEstimate 전달 — PDF 자재집계표/산출근거서용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructionEstimate?: any;
  /** scope summary 보강 — 호출자 입력 */
  projectName?: string;
  addressText?: string;
  apartmentName?: string;
  exclusiveAreaM2?: number;
  totalAreaM2?: number;
  expansionOption?: "basic" | "expanded" | "mixed" | "unknown";
  scopeSummary?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  let body: BodyInput;
  try {
    body = (await req.json()) as BodyInput;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
  }

  if (!body.projectId) {
    return NextResponse.json({ error: "projectId 필수" }, { status: 400 });
  }

  const mode: EstimateDocumentMode = body.mode || "consumer_preview";

  // 소비자 미리보기의 총액은 화면에서 무료지만 문서 발행은 통합 공개권에 포함한다.
  if (mode === "consumer_preview") {
    const accessId = normalizeEstimateAccessId(body.accessId);
    const {
      data: { user },
    } = await createServerClient().auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (!accessId || !(await hasEstimateBundleAccess(user.id, accessId))) {
      return NextResponse.json({ error: "ESTIMATE_BUNDLE_ACCESS_REQUIRED" }, { status: 403 });
    }
  }

  // consumer_id 조회 — workflow preview 모드(consumer_projects 미생성)에서도 PDF 생성 허용
  const admin = getAdmin();
  let consumerId = "";
  const isPreviewMode = mode === "consumer_preview";
  if (admin) {
    // projectId가 uuid 형식일 때만 DB 조회 (preview / sessionStorage uuid 둘 다 처리)
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.projectId,
    );
    if (looksLikeUuid) {
      const { data: project } = await admin
        .from("consumer_projects")
        .select("user_id")
        .eq("id", body.projectId)
        .maybeSingle();
      if (project) {
        consumerId = (project as { user_id?: string }).user_id || "";
      }
    }
  }
  // preview 모드는 consumer 누락 허용 — anonymous 사용자에게도 PDF 미리보기 제공
  if (!consumerId && !isPreviewMode) {
    return NextResponse.json(
      { error: "PROJECT_NOT_FOUND_OR_NO_CONSUMER", hint: "유효한 projectId가 필요" },
      { status: 404 },
    );
  }

  // contractor_bid / matched_contract — contractorId 필수
  if ((mode === "contractor_bid" || mode === "matched_contract") && !body.contractorId) {
    return NextResponse.json(
      { error: "CONTRACTOR_ID_REQUIRED", hint: `mode=${mode}는 contractorId 필요` },
      { status: 400 },
    );
  }

  // party snapshots
  const [consumer, contractor] = await Promise.all([
    resolveConsumerPartySnapshot({
      projectId: body.projectId,
      consumerId,
      mode,
    }),
    body.contractorId
      ? resolveContractorPartySnapshot({ contractorId: body.contractorId })
      : Promise.resolve(undefined),
  ]);
  const inpick = resolveInPickPartySnapshot();

  // project scope snapshot
  const project: ProjectScopeSnapshot = {
    projectId: body.projectId,
    consumerId,
    rfqId: body.rfqId,
    bidId: body.bidId,
    contractId: body.contractId,
    projectName: body.projectName || `프로젝트 ${body.projectId.slice(0, 8)}`,
    addressText: body.addressText || consumer.address || "",
    apartmentName: body.apartmentName,
    exclusiveAreaM2: body.exclusiveAreaM2,
    totalAreaM2: body.totalAreaM2,
    expansionOption: body.expansionOption,
    scopeSummary:
      body.scopeSummary ||
      "도면 기반 17공종 견적 — 디자인/자재 선택 + 물량산출 결합.",
  };

  // build package
  const pkg = buildEstimateDocumentPackage({
    projectId: body.projectId,
    rfqId: body.rfqId,
    bidId: body.bidId,
    contractId: body.contractId,
    contractorId: body.contractorId,
    mode,
    project,
    consumer,
    contractor: contractor || undefined,
    inpick,
    buildEstimateResult: body.buildEstimateResult,
    constructionEstimate: body.constructionEstimate,
  });

  // DB insert — preview 모드는 실패해도 200 (anonymous 사용자 PDF 다운로드 지원)
  let inserted: { id: string; documentNo: string } | null = null;
  try {
    inserted = await insertEstimateDocument(pkg, {
      rfqId: body.rfqId,
      bidId: body.bidId,
      contractId: body.contractId,
      contractorId: body.contractorId,
    });
  } catch (err) {
    console.warn("[estimate-documents] insert exception (non-fatal):", err);
  }

  if (!inserted && !isPreviewMode) {
    return NextResponse.json(
      {
        error: "DOCUMENT_INSERT_FAILED",
        // DB 실패 시 — 패키지는 그대로 반환 (UI에서 클라 측 PDF 생성)
        package: pkg,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    documentId: inserted?.id,
    documentNo: inserted?.documentNo || pkg.documentNo,
    mode,
    status: pkg.status,
    totalAmount: pkg.summary.totalAmount,
    // 패키지 전체 — 클라이언트에서 jsPDF 생성 가능
    package: pkg,
  });
}
