import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PHASES = [
  "철거", "기초/설비 배관", "전기 배선", "목공", "타일/방수", "도배/도장", "마무리/검수",
];

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const status = req.nextUrl.searchParams.get("status");

    let query = supabase
      .from("contractor_projects")
      .select(`*, project_phases(count)`)
      .eq("contractor_id", contractorId)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error("Projects GET error:", error);
      return NextResponse.json({ error: "프로젝트 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ projects: data || [] });
  } catch (err) {
    console.error("Projects GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, name, contractId, estimateId, address, startDate, endDate, totalBudget } = body;

    if (!contractorId || !name) {
      return NextResponse.json({ error: "contractorId, name 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 프로젝트 생성
    const { data: project, error: projectError } = await supabase
      .from("contractor_projects")
      .insert({
        contractor_id: contractorId,
        contract_id: contractId || null,
        estimate_id: estimateId || null,
        name,
        address: address || null,
        start_date: startDate || null,
        end_date: endDate || null,
        total_budget: totalBudget || 0,
        status: "planning",
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Project create error:", projectError);
      return NextResponse.json({ error: "프로젝트 생성 실패" }, { status: 500 });
    }

    // 기본 공정 생성
    const phases = DEFAULT_PHASES.map((name, idx) => ({
      project_id: project.id,
      name,
      phase_order: idx + 1,
      status: "pending",
      checklist: [],
      dependencies: idx > 0 ? [DEFAULT_PHASES[idx - 1]] : [],
    }));

    const { error: phaseError } = await supabase
      .from("project_phases")
      .insert(phases);

    if (phaseError) {
      console.error("Phase create error:", phaseError);
    }

    // 활동 로그
    await supabase.from("project_activities").insert({
      project_id: project.id,
      activity_type: "created",
      description: "프로젝트가 생성되었습니다",
      actor: "시스템",
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("Projects POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
