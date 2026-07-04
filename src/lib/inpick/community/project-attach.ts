/**
 * 커뮤니티 "내 프로젝트 첨부" 공용 로직.
 * my-projects(피커 목록)와 posts POST(첨부 실행)가 공유.
 * ⚠️ 실제 스키마 컬럼 기준: design_outputs.target_name / construction_estimates.total_with_vat
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProjectCardData {
  projectId: string;
  regionLabel: string | null;
  areaLabel: string | null;
  images: Array<{ url: string; label: string }>;
  floorPlanImageUrl: string | null;
  estimateTotal: number | null;
  projectMode: string | null;
}

/** 도로명에서 시·구 단위만 노출 (개인정보 보호 — 상세 주소 마스킹) */
export function regionFromAddress(addr: unknown, workflowState: unknown): string | null {
  const road =
    (addr as { roadAddress?: string } | null)?.roadAddress ||
    ((workflowState as { step1?: { basicInfo?: { selectedAddress?: { roadAddress?: string } } } } | null)
      ?.step1?.basicInfo?.selectedAddress?.roadAddress ?? "");
  if (!road) return null;
  const parts = road.split(" ").filter(Boolean);
  return parts.slice(0, 2).join(" ") || null;
}

export function areaFromWorkflow(workflowState: unknown): string | null {
  const py = (workflowState as {
    step1?: { basicInfo?: { selectedPyeong?: { exclusiveArea?: number; pyeongName?: string } } };
  } | null)?.step1?.basicInfo?.selectedPyeong;
  if (!py) return null;
  if (py.pyeongName) return py.pyeongName;
  if (py.exclusiveArea) return `전용 ${py.exclusiveArea}㎡`;
  return null;
}

/**
 * 단일 프로젝트의 첨부 카드 데이터 로드 (소유권 검증 포함).
 * 반환 null = 프로젝트 없음/권한 없음.
 */
export async function fetchProjectCard(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ProjectCardData | null> {
  const { data: proj } = await admin
    .from("consumer_projects")
    .select("id, user_id, address, workflow_state, floor_plan_image_url")
    .eq("id", projectId)
    .maybeSingle();
  const p = proj as {
    id: string;
    user_id: string;
    address: unknown;
    workflow_state: unknown;
    floor_plan_image_url: string | null;
  } | null;
  if (!p || p.user_id !== userId) return null;

  const { data: outputs } = await admin
    .from("design_outputs")
    .select("image_url, target_name, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(24);
  const images: Array<{ url: string; label: string }> = [];
  for (const o of (outputs ?? []) as Array<{ image_url: string; target_name: string }>) {
    if (!o.image_url) continue;
    if (images.length >= 8) break;
    if (images.some((x) => x.url === o.image_url)) continue;
    images.push({ url: o.image_url, label: o.target_name || "디자인" });
  }

  const { data: est } = await admin
    .from("construction_estimates")
    .select("total_with_vat, project_mode, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const e = est as { total_with_vat: number | null; project_mode: string | null } | null;

  return {
    projectId,
    regionLabel: regionFromAddress(p.address, p.workflow_state),
    areaLabel: areaFromWorkflow(p.workflow_state),
    images,
    floorPlanImageUrl: p.floor_plan_image_url,
    estimateTotal: e?.total_with_vat != null ? Number(e.total_with_vat) : null,
    projectMode: e?.project_mode ?? null,
  };
}
