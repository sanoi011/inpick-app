/**
 * POST /api/inpick/estimate-context/finalize
 *
 * 견적 페이지 진입 직전 호출 — Step1 + scope + designOutputs + materialEvidence + userMaterialEdits를
 * 하나의 estimate_contexts row로 묶어 contextId를 발급.
 *
 * 가이드: inpick-step2-estimate-evidence-pipeline-fix-20260512.md §6-4
 *
 * 중요:
 *   - canBuildEstimate는 전체 이미지 유무나 visionAnalysisByRoom 유무로 절대 판단하지 않음
 *   - projectMode별 최소 조건만 체크 (대부분 API가 폴백 처리하므로 false 케이스는 거의 없음)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { computeEstimateReadiness } from "@/lib/inpick/estimate-context/readiness";
import {
  mapDbDesignOutput,
  type DesignOutput,
  type EstimateReadiness,
  type ProjectMode,
} from "@/lib/inpick/estimate-context/types";
import {
  selectFinalDesignOutputs,
  type FinalSelectedDesign,
} from "@/lib/inpick/estimate-context/final-selection";
import {
  collectFinalSelectionImageUrls,
  filterRecordsForSelectedRooms,
  normalizeEstimateStep1Snapshot,
} from "@/lib/inpick/estimate-context/photo-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    console.error("[estimate-context/finalize] auth check failed:", err);
    return null;
  }
}

interface FinalizeBody {
  projectId: string;
  projectMode: ProjectMode;
  /** 클라이언트가 보유한 sessionStorage step1 — 서버는 이를 신뢰하되 design_outputs는 DB에서 다시 조회 */
  step1Snapshot?: Record<string, unknown>;
  scopeSnapshot?: Record<string, unknown>;
  /** 옵션: 클라이언트가 직접 보낸 user material edits (편집기에서 누른 자재) */
  userMaterialEdits?: unknown[];
  /** 새 Step2: 실별 최종 선택 이미지만 견적 근거로 사용 */
  selectionMode?: "final_images_only";
  selectedDesigns?: FinalSelectedDesign[];
}

interface FinalizeResponse {
  contextId: string;
  canBuildEstimate: boolean;
  estimateLevel: EstimateReadiness["estimateLevel"];
  readinessScore: number;
  missingBlockingFields: string[];
  missingOptionalFields: string[];
  warnings: string[];
}

const VALID_MODES: ProjectMode[] = ["apartment", "photo_only", "commercial"];

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: "MISSING_PROJECT_ID" }, { status: 400 });
  }
  if (!VALID_MODES.includes(body.projectMode)) {
    return NextResponse.json({ error: "INVALID_PROJECT_MODE" }, { status: 400 });
  }

  // 1) design_outputs DB 조회 (소유 + 같은 projectId)
  const { data: designOutputRows, error: doErr } = await admin
    .from("design_outputs")
    .select("*")
    .eq("project_id", body.projectId)
    .eq("user_id", userId);
  if (doErr) {
    console.error("[estimate-context/finalize] design_outputs select failed:", doErr);
  }
  const allDesignOutputs: DesignOutput[] = (designOutputRows ?? []).map(mapDbDesignOutput);
  const requestedSelections = (Array.isArray(body.selectedDesigns) ? body.selectedDesigns : [])
    .filter(
      (selection) =>
        typeof selection?.targetId === "string" &&
        selection.targetId.length > 0 &&
        typeof selection?.imageUrl === "string" &&
        selection.imageUrl.length > 0,
    )
    .slice(0, 50);
  const finalImagesOnly =
    body.selectionMode === "final_images_only" && requestedSelections.length > 0;
  const step1Snapshot = normalizeEstimateStep1Snapshot(
    body.step1Snapshot,
    body.projectMode,
  );
  const designOutputs = finalImagesOnly
    ? selectFinalDesignOutputs(allDesignOutputs, requestedSelections, {
        projectId: body.projectId,
        userId,
        projectMode: body.projectMode,
      })
    : allDesignOutputs;

  // 2) material evidence 조회 — material_vision_observations 테이블 (있다면)
  //    P3에서 실제 분석 결과가 채워지면 의미 있어짐. 현재는 빈 배열 fallback.
  const relevantImageUrls = finalImagesOnly
    ? collectFinalSelectionImageUrls(designOutputs, requestedSelections)
    : undefined;
  const materialEvidence = await fetchMaterialEvidence(
    admin,
    body.projectId,
    designOutputs,
    relevantImageUrls,
  );

  // 3) commercial scope 조회
  const scopeSnapshot = await fetchScopeSnapshot(
    admin,
    body.projectId,
    body.projectMode,
    body.scopeSnapshot,
  );

  // 4) user_material_edits (편집기 자재 선택)
  const allUserMaterialEdits = dedupeMaterialEdits([
    ...(await fetchUserMaterialEdits(admin, body.projectId, userId)),
    ...materialEvidence
      .filter((evidence) => evidence.decisionType === "user_selected")
      .map(materialEvidenceToUserEdit),
    ...(Array.isArray(body.userMaterialEdits) ? body.userMaterialEdits : []),
  ]);
  const userMaterialEdits = finalImagesOnly
    ? filterRecordsForSelectedRooms(allUserMaterialEdits, designOutputs)
    : allUserMaterialEdits;

  // 5) readiness 계산
  const readiness = computeEstimateReadiness({
    projectMode: body.projectMode,
    step1Snapshot,
    scopeSnapshot,
    designOutputs,
    materialEvidence,
    userMaterialEdits,
  });

  // 6) estimate_contexts insert
  const { data: ctxRow, error: insertErr } = await admin
    .from("estimate_contexts")
    .insert({
      project_id: body.projectId,
      user_id: userId,
      project_mode: body.projectMode,
      step1_snapshot: step1Snapshot,
      scope_snapshot: scopeSnapshot ?? {},
      design_outputs_snapshot: designOutputs,
      material_evidence_snapshot: materialEvidence,
      user_material_edits_snapshot: userMaterialEdits,
      estimate_level: readiness.estimateLevel,
      readiness_score: readiness.score,
      can_build_estimate: readiness.canBuildEstimate,
      missing_blocking_fields: readiness.missingBlockingFields,
      missing_optional_fields: readiness.missingOptionalFields,
      warnings: readiness.warnings,
    })
    .select("id")
    .single();

  if (insertErr || !ctxRow) {
    console.error("[estimate-context/finalize] insert failed:", insertErr);
    return NextResponse.json(
      { error: "INSERT_FAILED", details: insertErr?.message },
      { status: 500 },
    );
  }

  const response: FinalizeResponse = {
    contextId: String(ctxRow.id),
    canBuildEstimate: readiness.canBuildEstimate,
    estimateLevel: readiness.estimateLevel,
    readinessScore: readiness.score,
    missingBlockingFields: readiness.missingBlockingFields,
    missingOptionalFields: readiness.missingOptionalFields,
    warnings: readiness.warnings,
  };
  return NextResponse.json(response);
}

/**
 * material_vision_observations 조회.
 * 테이블이 없거나 에러 시 빈 배열 — finalize는 절대 실패하지 않음.
 */
interface MaterialEvidenceSnapshot {
  observationId: string;
  projectId: string;
  roomId: string;
  roomName: string;
  surfaceType: string;
  sourceImageUrl: string;
  materialProductId?: string;
  materialCategory?: string;
  materialNameKo?: string;
  brand?: string;
  sku?: string;
  spec?: string;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  matchStatus: "confirmed" | "recommended" | "fallback";
  confidence: number;
  candidateId?: string;
  decisionId?: string;
  decisionType?: string;
}

async function fetchMaterialEvidence(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  designOutputs: DesignOutput[],
  relevantImageUrls?: Set<string>,
): Promise<MaterialEvidenceSnapshot[]> {
  try {
    const { data: observationData, error } = await admin
      .from("material_vision_observations")
      .select("id, project_id, room_id, source_image_url, surface_type, confidence, status, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    const allowedImages =
      relevantImageUrls ?? new Set(designOutputs.map((output) => output.imageUrl));
    const observations = (observationData ?? []).filter((row) =>
      allowedImages.has(String(row.source_image_url || "")),
    );
    if (observations.length === 0) return [];

    const observationIds = observations.map((row) => String(row.id));
    const [{ data: decisionData }, { data: candidateData }] = await Promise.all([
      admin
        .from("material_match_decisions")
        .select("id, observation_id, selected_material_product_id, decision_type, confidence, decided_at")
        .in("observation_id", observationIds)
        .order("decided_at", { ascending: false }),
      admin
        .from("material_match_candidates")
        .select("id, observation_id, material_product_id, rank, confidence")
        .in("observation_id", observationIds)
        .order("rank", { ascending: true }),
    ]);

    const latestDecision = new Map<string, Record<string, unknown>>();
    for (const row of (decisionData ?? []) as Array<Record<string, unknown>>) {
      const observationId = String(row.observation_id);
      if (!latestDecision.has(observationId)) latestDecision.set(observationId, row);
    }
    const topCandidate = new Map<string, Record<string, unknown>>();
    for (const row of (candidateData ?? []) as Array<Record<string, unknown>>) {
      const observationId = String(row.observation_id);
      if (!topCandidate.has(observationId)) topCandidate.set(observationId, row);
    }

    const productIds = Array.from(
      new Set(
        observations
          .map((observation) => {
            const observationId = String(observation.id);
            return (
              latestDecision.get(observationId)?.selected_material_product_id ||
              topCandidate.get(observationId)?.material_product_id
            );
          })
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    const { data: productData } = productIds.length
      ? await admin
          .from("material_products")
          .select("id, category_code, brand, product_name, model_number, specification, unit, contractor_price, retail_price")
          .in("id", productIds)
      : { data: [] };
    const products = new Map(
      ((productData ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );
    const outputByRoomId = new Map(designOutputs.map((output) => [output.targetId, output]));
    const outputByImage = new Map(designOutputs.map((output) => [output.imageUrl, output]));

    return observations.map((observation) => {
      const observationId = String(observation.id);
      const decision = latestDecision.get(observationId);
      const candidate = topCandidate.get(observationId);
      const productId = String(
        decision?.selected_material_product_id || candidate?.material_product_id || "",
      );
      const product = products.get(productId);
      const decisionType = decision?.decision_type ? String(decision.decision_type) : undefined;
      const explicitlyConfirmed =
        decisionType === "user_selected" ||
        decisionType === "contractor_selected" ||
        decisionType === "auto_high_confidence";
      const output =
        outputByRoomId.get(String(observation.room_id || "")) ||
        outputByImage.get(String(observation.source_image_url || ""));
      const contractorPrice = Number(product?.contractor_price || 0);
      const retailPrice = Number(product?.retail_price || 0);

      return {
        observationId,
        projectId,
        roomId: String(observation.room_id || output?.targetId || "whole"),
        roomName: output?.targetName || String(observation.room_id || "전체 공간"),
        surfaceType: String(observation.surface_type || "unknown"),
        sourceImageUrl: String(observation.source_image_url || ""),
        materialProductId: productId || undefined,
        materialCategory: product?.category_code ? String(product.category_code) : undefined,
        materialNameKo: product?.product_name ? String(product.product_name) : undefined,
        brand: product?.brand ? String(product.brand) : undefined,
        sku: product?.model_number ? String(product.model_number) : undefined,
        spec: product?.specification ? String(product.specification) : undefined,
        unit: product?.unit ? String(product.unit) : undefined,
        unitPrice: contractorPrice || retailPrice || undefined,
        priceSource: contractorPrice ? "contractor_price" : retailPrice ? "retail_price" : undefined,
        matchStatus: productId ? (explicitlyConfirmed ? "confirmed" : "recommended") : "fallback",
        confidence: Number(decision?.confidence ?? candidate?.confidence ?? observation.confidence ?? 0),
        candidateId: candidate?.id ? String(candidate.id) : undefined,
        decisionId: decision?.id ? String(decision.id) : undefined,
        decisionType,
      } satisfies MaterialEvidenceSnapshot;
    });
  } catch {
    return [];
  }
}

function materialEvidenceToUserEdit(evidence: MaterialEvidenceSnapshot): Record<string, unknown> {
  return {
    id: evidence.decisionId || evidence.observationId,
    roomId: evidence.roomId,
    roomName: evidence.roomName,
    surfaceType: mapEvidenceSurface(evidence.surfaceType),
    materialCategory: evidence.materialCategory || evidence.surfaceType,
    materialProductId: evidence.materialProductId,
    materialNameKo: evidence.materialNameKo,
    brand: evidence.brand,
    sku: evidence.sku,
    spec: evidence.spec,
    unitPrice: evidence.unitPrice,
    priceSource: evidence.priceSource,
    observationId: evidence.observationId,
    confidence: evidence.confidence,
  };
}

function mapEvidenceSurface(surfaceType: string): string {
  if (
    ["floor", "wall", "ceiling", "door", "window", "lighting", "fixture", "sink"].includes(
      surfaceType,
    )
  ) {
    return surfaceType;
  }
  if (surfaceType === "cabinet") return "built_in_furniture";
  if (surfaceType === "countertop") return "counter";
  if (surfaceType === "tile") return "wall";
  return "unknown";
}

function dedupeMaterialEdits(edits: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const edit of edits) {
    if (!edit || typeof edit !== "object") continue;
    const row = edit as Record<string, unknown>;
    const key = `${String(row.roomId || row.room_id || "")}:${String(
      row.surfaceType || row.surface_type || "",
    )}:${String(row.partCode || row.part_code || "")}`;
    map.set(key, edit);
  }
  return Array.from(map.values());
}

/**
 * commercial_scope_snapshots 또는 클라이언트가 보낸 scope 조회.
 */
async function fetchScopeSnapshot(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  mode: ProjectMode,
  fromClient?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (fromClient && Object.keys(fromClient).length > 0) return fromClient;
  if (mode !== "commercial") return fromClient ?? null;
  try {
    const { data, error } = await admin
      .from("commercial_scope_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * render_material_edits 조회 (없으면 빈 배열).
 */
async function fetchUserMaterialEdits(
  admin: NonNullable<ReturnType<typeof getAdmin>>,
  projectId: string,
  userId: string,
): Promise<unknown[]> {
  try {
    const { data: editData, error } = await admin
      .from("render_material_edits")
      .select("id, layer_id, editable_render_id, material_product_id, created_by, created_at")
      .eq("project_id", projectId)
      .or(`created_by.eq.${userId},created_by.is.null`)
      .order("created_at", { ascending: false });
    if (error) return [];
    const latestByLayer = new Map<string, Record<string, unknown>>();
    for (const row of (editData ?? []) as Array<Record<string, unknown>>) {
      const layerId = String(row.layer_id || "");
      if (layerId && !latestByLayer.has(layerId)) latestByLayer.set(layerId, row);
    }
    const edits = Array.from(latestByLayer.values());
    if (edits.length === 0) return [];
    const layerIds = edits.map((row) => String(row.layer_id));
    const renderIds = Array.from(new Set(edits.map((row) => String(row.editable_render_id))));
    const productIds = Array.from(
      new Set(
        edits
          .map((row) => row.material_product_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    const [{ data: layerData }, { data: renderData }, { data: productData }] = await Promise.all([
      admin
        .from("editable_render_layers")
        .select("id, target_id, surface_type, label_ko, area_m2")
        .in("id", layerIds),
      admin
        .from("editable_renders")
        .select("id, target_id, target_name_ko")
        .in("id", renderIds),
      productIds.length
        ? admin
            .from("material_products")
            .select("id, category_code, brand, product_name, model_number, specification, contractor_price, retail_price")
            .in("id", productIds)
        : Promise.resolve({ data: [] }),
    ]);
    const layers = new Map(
      ((layerData ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );
    const renders = new Map(
      ((renderData ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );
    const products = new Map(
      ((productData ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );

    return edits.flatMap((edit) => {
      const layer = layers.get(String(edit.layer_id));
      const render = renders.get(String(edit.editable_render_id));
      const productId = String(edit.material_product_id || "");
      const product = products.get(productId);
      if (!layer || !product) return [];
      const contractorPrice = Number(product.contractor_price || 0);
      const retailPrice = Number(product.retail_price || 0);
      return [{
        id: String(edit.id),
        roomId: String(layer.target_id || render?.target_id || "whole"),
        roomName: String(render?.target_name_ko || layer.label_ko || "전체 공간"),
        surfaceType: mapEvidenceSurface(String(layer.surface_type || "unknown")),
        materialCategory: String(product.category_code || layer.surface_type || "unknown"),
        materialProductId: productId,
        materialNameKo: String(product.product_name || layer.label_ko || "선택 자재"),
        brand: product.brand ? String(product.brand) : undefined,
        sku: product.model_number ? String(product.model_number) : undefined,
        spec: product.specification ? String(product.specification) : undefined,
        unitPrice: contractorPrice || retailPrice || undefined,
        priceSource: contractorPrice ? "contractor_price" : retailPrice ? "retail_price" : undefined,
        confidence: 1,
      }];
    });
  } catch {
    return [];
  }
}

interface ContextGetResponse {
  context: {
    id: string;
    projectId: string;
    projectMode: ProjectMode;
    step1Snapshot: Record<string, unknown>;
    scopeSnapshot: Record<string, unknown>;
    designOutputs: DesignOutput[];
    materialEvidence: unknown[];
    userMaterialEdits: unknown[];
    estimateLevel: EstimateReadiness["estimateLevel"];
    readinessScore: number;
    canBuildEstimate: boolean;
    warnings: string[];
    missingOptionalFields: string[];
    missingBlockingFields: string[];
    createdAt: string;
  };
}

/**
 * GET /api/inpick/estimate-context/finalize?contextId=... — 단일 context 조회 (견적 페이지 새로고침용)
 */
export async function GET(req: NextRequest): Promise<NextResponse<ContextGetResponse | { error: string }>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED" }, { status: 500 });
  }
  const contextId = req.nextUrl.searchParams.get("contextId");
  if (!contextId) {
    return NextResponse.json({ error: "MISSING_CONTEXT_ID" }, { status: 400 });
  }
  const { data, error } = await admin
    .from("estimate_contexts")
    .select("*")
    .eq("id", contextId)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const designOutputs = Array.isArray(data.design_outputs_snapshot)
    ? (data.design_outputs_snapshot as DesignOutput[])
    : [];
  return NextResponse.json({
    context: {
      id: String(data.id),
      projectId: String(data.project_id),
      projectMode: data.project_mode as ProjectMode,
      step1Snapshot: (data.step1_snapshot as Record<string, unknown>) ?? {},
      scopeSnapshot: (data.scope_snapshot as Record<string, unknown>) ?? {},
      designOutputs,
      materialEvidence: Array.isArray(data.material_evidence_snapshot)
        ? (data.material_evidence_snapshot as unknown[])
        : [],
      userMaterialEdits: Array.isArray(data.user_material_edits_snapshot)
        ? (data.user_material_edits_snapshot as unknown[])
        : [],
      estimateLevel: data.estimate_level as EstimateReadiness["estimateLevel"],
      readinessScore: Number(data.readiness_score) || 0,
      canBuildEstimate: Boolean(data.can_build_estimate),
      warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
      missingOptionalFields: Array.isArray(data.missing_optional_fields)
        ? (data.missing_optional_fields as string[])
        : [],
      missingBlockingFields: Array.isArray(data.missing_blocking_fields)
        ? (data.missing_blocking_fields as string[])
        : [],
      createdAt: String(data.created_at),
    },
  });
}
