/**
 * GET /api/community/my-projects — "내 프로젝트 첨부" 피커용.
 * 로그인 유저의 AI 인테리어 프로젝트 중 자랑할 거리(디자인 이미지)가 있는 것만 반환.
 *
 * 소스 (실제 컬럼 기준 — share-from-estimate의 잘못된 컬럼 참조와 다름):
 *   consumer_projects: id, address(JSONB), workflow_state(basicInfo), floor_plan_image_url
 *   design_outputs: image_url, target_name (project_id별)
 *   construction_estimates: total_with_vat (최신 버전)
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { regionFromAddress, areaFromWorkflow } from "@/lib/inpick/community/project-attach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AttachableProject {
  projectId: string;
  title: string;
  regionLabel: string | null;
  areaLabel: string | null;
  images: Array<{ url: string; label: string }>;
  floorPlanImageUrl: string | null;
  estimateTotal: number | null;
  createdAt: string;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // 1) 내 프로젝트 (최근 30개)
  const { data: projects, error: projErr } = await admin
    .from("consumer_projects")
    .select("id, address, workflow_state, floor_plan_image_url, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (projErr) {
    return NextResponse.json({ error: "PROJECTS_QUERY_FAILED", hint: projErr.message }, { status: 500 });
  }
  const rows = (projects ?? []) as Array<{
    id: string;
    address: unknown;
    workflow_state: unknown;
    floor_plan_image_url: string | null;
    created_at: string;
  }>;
  if (rows.length === 0) return NextResponse.json({ projects: [] });

  const ids = rows.map((r) => r.id);

  // 2) 디자인 이미지 (프로젝트별 최신순)
  const { data: outputs } = await admin
    .from("design_outputs")
    .select("project_id, image_url, target_name, created_at")
    .in("project_id", ids)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  const imagesByProject = new Map<string, Array<{ url: string; label: string }>>();
  for (const o of (outputs ?? []) as Array<{ project_id: string; image_url: string; target_name: string }>) {
    if (!o.image_url) continue;
    const arr = imagesByProject.get(o.project_id) ?? [];
    if (arr.length < 8 && !arr.some((x) => x.url === o.image_url)) {
      arr.push({ url: o.image_url, label: o.target_name || "디자인" });
    }
    imagesByProject.set(o.project_id, arr);
  }

  // 3) 견적 총액 (프로젝트별 최신 버전)
  const { data: estimates } = await admin
    .from("construction_estimates")
    .select("project_id, total_with_vat, version, created_at")
    .in("project_id", ids)
    .order("created_at", { ascending: false });
  const totalByProject = new Map<string, number>();
  for (const e of (estimates ?? []) as Array<{ project_id: string; total_with_vat: number | null }>) {
    if (!totalByProject.has(e.project_id) && e.total_with_vat != null) {
      totalByProject.set(e.project_id, Number(e.total_with_vat));
    }
  }

  const result: AttachableProject[] = rows
    .map((r) => {
      const images = imagesByProject.get(r.id) ?? [];
      const regionLabel = regionFromAddress(r.address, r.workflow_state);
      const areaLabel = areaFromWorkflow(r.workflow_state);
      return {
        projectId: r.id,
        title: [regionLabel, areaLabel].filter(Boolean).join(" · ") || "내 AI 인테리어 프로젝트",
        regionLabel,
        areaLabel,
        images,
        floorPlanImageUrl: r.floor_plan_image_url,
        estimateTotal: totalByProject.get(r.id) ?? null,
        createdAt: r.created_at,
      };
    })
    // 자랑할 이미지가 하나라도 있는 프로젝트만
    .filter((p) => p.images.length > 0 || p.floorPlanImageUrl);

  return NextResponse.json({ projects: result });
}
