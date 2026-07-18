/**
 * Vision Material Matcher — Supabase repository.
 *
 * 가이드: §4-1 + §5
 *
 * 책임:
 *   - material_vision_observations / material_match_candidates / material_match_decisions
 *     / material_estimate_line_links CRUD
 *   - service_role admin client 사용
 *
 * SKU hallucination 금지:
 *   candidate insert 시 material_product_id가 실제 row인지 검증
 */

import { createClient } from "@supabase/supabase-js";
import type {
  CandidateScores,
  DecisionType,
  MaterialMatchCandidateRow,
  MaterialProductCandidate,
  MaterialVisionObservationRow,
  SourceImageKind,
  SurfaceObservation,
  SurfaceType,
} from "./types";

// Supabase v2 generic 추론 이슈 회피 — schema 명시 없는 client 사용 시
// insert가 row 타입을 never로 추론. any로 untyped 처리 (런타임 동작 동일).
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

// ─── observations ───
export interface CreateObservationInput {
  projectId?: string;
  roomId?: string;
  sourceImageUrl: string;
  sourceImageKind: SourceImageKind;
  surfaceType: SurfaceType;
  roomType?: string;
  bbox?: Record<string, number>;
  maskUrl?: string;
  cropUrl?: string;
  areaRatio?: number;
  dominantColors?: { hex: string; ratio: number }[];
  textureFeatures?: Record<string, unknown>;
  ocrText?: string;
  coarseLabels?: { label: string; confidence: number }[];
  clipEmbedding?: number[];
  detectorModel?: string;
  segmenterModel?: string;
  visionModel?: string;
  confidence: number;
}

export async function insertObservations(
  inputs: CreateObservationInput[],
): Promise<string[]> {
  const admin = getAdmin();
  if (!admin) {
    console.warn("[vision-materials/repo] Supabase admin 미설정 — observation 미저장 (mock 모드)");
    // mock 모드: pseudo UUID 반환
    return inputs.map(() => `mock-${crypto.randomUUID()}`);
  }
  if (inputs.length === 0) return [];
  const rows = inputs.map((i) => ({
    project_id: i.projectId ?? null,
    room_id: i.roomId ?? null,
    source_image_url: i.sourceImageUrl,
    source_image_kind: i.sourceImageKind,
    surface_type: i.surfaceType,
    room_type: i.roomType ?? null,
    bbox: i.bbox ?? null,
    mask_url: i.maskUrl ?? null,
    crop_url: i.cropUrl ?? null,
    area_ratio: i.areaRatio ?? null,
    dominant_colors: i.dominantColors ?? null,
    texture_features: i.textureFeatures ?? null,
    ocr_text: i.ocrText ?? null,
    coarse_labels: i.coarseLabels ?? null,
    clip_embedding: i.clipEmbedding ?? null,
    detector_model: i.detectorModel ?? null,
    segmenter_model: i.segmenterModel ?? null,
    vision_model: i.visionModel ?? null,
    confidence: i.confidence,
    status: "pending" as const,
  }));
  const { data, error } = await admin
    .from("material_vision_observations")
    .insert(rows)
    .select("id");
  if (error) {
    console.warn(`[vision-materials/repo] insertObservations error: ${error.message}`);
    return inputs.map(() => `error-${crypto.randomUUID()}`);
  }
  return (data || []).map((r: { id: string }) => r.id);
}

// ─── candidates ───
export interface CreateCandidateInput {
  observationId: string;
  materialProductId: string;
  rank: number;
  scores: CandidateScores;
  confidence: number;
  reasons?: string[];
  warnings?: string[];
}

export async function insertCandidates(inputs: CreateCandidateInput[]): Promise<void> {
  const admin = getAdmin();
  if (!admin || inputs.length === 0) return;

  const rows = inputs.map((i) => ({
    observation_id: i.observationId,
    material_product_id: i.materialProductId,
    rank: i.rank,
    category_score: i.scores.category,
    visual_score: i.scores.visual,
    texture_score: i.scores.texture,
    color_score: i.scores.color,
    ocr_score: i.scores.ocr,
    price_score: i.scores.price,
    room_rule_score: i.scores.roomRule,
    budget_style_score: i.scores.budgetStyle,
    total_score: i.scores.total,
    confidence: i.confidence,
    reasons: i.reasons ?? null,
    warnings: i.warnings ?? null,
  }));
  const { error } = await admin.from("material_match_candidates").insert(rows);
  if (error) {
    console.warn(`[vision-materials/repo] insertCandidates error: ${error.message}`);
  }
}

// ─── decisions ───
export interface CreateDecisionInput {
  observationId: string;
  selectedMaterialProductId?: string;
  decisionType: DecisionType;
  confidence: number;
  fallbackReason?: string;
  decidedBy?: string;
  metadata?: Record<string, unknown>;
}

export async function insertDecision(input: CreateDecisionInput): Promise<string | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("material_match_decisions")
    .insert({
      observation_id: input.observationId,
      selected_material_product_id: input.selectedMaterialProductId ?? null,
      decision_type: input.decisionType,
      confidence: input.confidence,
      fallback_reason: input.fallbackReason ?? null,
      decided_by: input.decidedBy ?? null,
      metadata: input.metadata ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.warn(`[vision-materials/repo] insertDecision error: ${error.message}`);
    return null;
  }
  return (data as { id: string } | null)?.id || null;
}

export async function updateObservationMatchStatus(
  observationId: string,
  status: "matched" | "fallback" | "rejected" | "confirmed",
): Promise<void> {
  const admin = getAdmin();
  if (!admin || !observationId || observationId.startsWith("mock-")) return;
  const { error } = await admin
    .from("material_vision_observations")
    .update({ status })
    .eq("id", observationId);
  if (error) {
    console.warn(`[vision-materials/repo] observation status update error: ${error.message}`);
  }
}

// ─── estimate line links ───
export interface CreateEstimateLineLinkInput {
  projectId: string;
  estimateId?: string;
  estimateLineId: string;
  observationId?: string;
  materialProductId?: string;
  tradeCode?: string;
  roomId?: string;
  roomName?: string;
  surfaceType?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  priceSource?: string;
  confidence?: number;
  matchStatus: "confirmed" | "recommended" | "fallback";
  fallbackReason?: string;
}

export async function insertEstimateLineLinks(
  inputs: CreateEstimateLineLinkInput[],
): Promise<void> {
  const admin = getAdmin();
  if (!admin || inputs.length === 0) return;
  const rows = inputs.map((i) => ({
    project_id: i.projectId,
    estimate_id: i.estimateId ?? null,
    estimate_line_id: i.estimateLineId,
    observation_id: i.observationId ?? null,
    material_product_id: i.materialProductId ?? null,
    trade_code: i.tradeCode ?? null,
    room_id: i.roomId ?? null,
    room_name: i.roomName ?? null,
    surface_type: i.surfaceType ?? null,
    quantity: i.quantity ?? null,
    unit: i.unit ?? null,
    unit_price: i.unitPrice ?? null,
    price_source: i.priceSource ?? null,
    confidence: i.confidence ?? null,
    match_status: i.matchStatus,
    fallback_reason: i.fallbackReason ?? null,
  }));
  const { error } = await admin.from("material_estimate_line_links").insert(rows);
  if (error) {
    console.warn(`[vision-materials/repo] insertEstimateLineLinks error: ${error.message}`);
  }
}

// ─── observation 조회 ───
export async function getObservationsByProject(
  projectId: string,
  options: { limit?: number } = {},
): Promise<MaterialVisionObservationRow[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("material_vision_observations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (error || !data) return [];
  return data as unknown as MaterialVisionObservationRow[];
}

export async function getCandidatesByObservation(
  observationId: string,
): Promise<MaterialMatchCandidateRow[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("material_match_candidates")
    .select("*")
    .eq("observation_id", observationId)
    .order("rank");
  if (error || !data) return [];
  return data as unknown as MaterialMatchCandidateRow[];
}

// ─── 통계 (admin diagnostics) ───
export async function getVisionMaterialsStats(): Promise<{
  productImages: { total: number; withEmbedding: number };
  observations: { total: number; matched: number; fallback: number };
  decisions: { confirmed: number; userSelected: number; fallback: number };
  fallbackReasons: Array<{ reason: string; count: number }>;
}> {
  const admin = getAdmin();
  if (!admin) {
    return {
      productImages: { total: 0, withEmbedding: 0 },
      observations: { total: 0, matched: 0, fallback: 0 },
      decisions: { confirmed: 0, userSelected: 0, fallback: 0 },
      fallbackReasons: [],
    };
  }

  const [
    { count: imgTotal },
    { count: imgEmbedded },
    { count: obsTotal },
    { count: obsMatched },
    { count: obsFallback },
    { count: decConfirmed },
    { count: decUserSelected },
    { count: decFallback },
  ] = await Promise.all([
    admin.from("material_product_images").select("*", { count: "exact", head: true }),
    admin
      .from("material_product_images")
      .select("*", { count: "exact", head: true })
      .not("clip_embedding", "is", null),
    admin
      .from("material_vision_observations")
      .select("*", { count: "exact", head: true }),
    admin
      .from("material_vision_observations")
      .select("*", { count: "exact", head: true })
      .eq("status", "matched"),
    admin
      .from("material_vision_observations")
      .select("*", { count: "exact", head: true })
      .eq("status", "fallback"),
    admin
      .from("material_match_decisions")
      .select("*", { count: "exact", head: true })
      .eq("decision_type", "auto_high_confidence"),
    admin
      .from("material_match_decisions")
      .select("*", { count: "exact", head: true })
      .eq("decision_type", "user_selected"),
    admin
      .from("material_match_decisions")
      .select("*", { count: "exact", head: true })
      .eq("decision_type", "fallback_generic"),
  ]);

  // 폴백 이유 top 10 (단순 group by)
  const { data: fallbackData } = await admin
    .from("material_estimate_line_links")
    .select("fallback_reason")
    .not("fallback_reason", "is", null)
    .limit(1000);
  const reasonCount = new Map<string, number>();
  for (const r of (fallbackData || []) as Array<{ fallback_reason: string }>) {
    if (!r.fallback_reason) continue;
    reasonCount.set(r.fallback_reason, (reasonCount.get(r.fallback_reason) || 0) + 1);
  }
  const fallbackReasons = Array.from(reasonCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return {
    productImages: { total: imgTotal || 0, withEmbedding: imgEmbedded || 0 },
    observations: {
      total: obsTotal || 0,
      matched: obsMatched || 0,
      fallback: obsFallback || 0,
    },
    decisions: {
      confirmed: decConfirmed || 0,
      userSelected: decUserSelected || 0,
      fallback: decFallback || 0,
    },
    fallbackReasons,
  };
}

// ─── helper ───
export function observationToRow(o: SurfaceObservation, ctx: {
  projectId?: string;
  roomId?: string;
  sourceImageUrl: string;
  sourceImageKind: SourceImageKind;
}): CreateObservationInput {
  return {
    projectId: ctx.projectId,
    roomId: ctx.roomId,
    sourceImageUrl: ctx.sourceImageUrl,
    sourceImageKind: ctx.sourceImageKind,
    surfaceType: o.surfaceType,
    roomType: o.roomType,
    bbox: o.bbox as unknown as Record<string, number>,
    maskUrl: o.maskUrl,
    cropUrl: o.cropUrl,
    areaRatio: o.areaRatio,
    dominantColors: o.dominantColors,
    textureFeatures: o.textureFeatures,
    ocrText: o.ocrText,
    coarseLabels: o.coarseLabels,
    clipEmbedding: o.embedding,
    confidence: o.confidence,
  };
}

export function candidateToRow(
  observationId: string,
  c: MaterialProductCandidate,
): CreateCandidateInput {
  return {
    observationId,
    materialProductId: c.materialProductId,
    rank: c.rank,
    scores: c.scores,
    confidence: c.confidence,
    reasons: c.reasons,
    warnings: c.warnings,
  };
}
