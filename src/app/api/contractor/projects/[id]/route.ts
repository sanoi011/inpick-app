import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const supabase = createClient();

    const { data: project, error } = await supabase
      .from("contractor_projects")
      .select(`
        *,
        project_phases(*),
        project_issues(*),
        project_activities(*)
      `)
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });
    }

    // 공정 순서 정렬
    if (project.project_phases) {
      (project.project_phases as { phase_order: number }[]).sort((a, b) => a.phase_order - b.phase_order);
    }

    // 활동 로그 최신순
    if (project.project_activities) {
      (project.project_activities as { created_at: string }[]).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("Project detail error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const body = await req.json();
    const { action, ...data } = body;
    const supabase = createClient();

    // 프로젝트 상태/진행률 업데이트
    if (action === "updateProject") {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.status) updates.status = data.status;
      if (data.progressPct !== undefined) updates.progress_pct = data.progressPct;
      if (data.startDate) updates.start_date = data.startDate;
      if (data.endDate) updates.end_date = data.endDate;

      const { error } = await supabase
        .from("contractor_projects")
        .update(updates)
        .eq("id", projectId);

      if (error) return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });

      // 활동 로그
      await supabase.from("project_activities").insert({
        project_id: projectId,
        activity_type: "status_change",
        description: `프로젝트 상태가 변경되었습니다${data.status ? `: ${data.status}` : ""}`,
        actor: data.actor || "사업자",
      });

      return NextResponse.json({ success: true });
    }

    // 공정 상태 업데이트
    if (action === "updatePhase") {
      const { phaseId, status: phaseStatus, checklist } = data;
      if (!phaseId) return NextResponse.json({ error: "phaseId 필요" }, { status: 400 });

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (phaseStatus) updates.status = phaseStatus;
      if (checklist !== undefined) updates.checklist = checklist;

      const { error } = await supabase
        .from("project_phases")
        .update(updates)
        .eq("id", phaseId);

      if (error) return NextResponse.json({ error: "공정 업데이트 실패" }, { status: 500 });

      // 진행률 재계산
      const { data: phases } = await supabase
        .from("project_phases")
        .select("status")
        .eq("project_id", projectId);

      if (phases && phases.length > 0) {
        const completed = phases.filter(p => p.status === "completed").length;
        const progressPct = Math.round((completed / phases.length) * 100);
        await supabase
          .from("contractor_projects")
          .update({ progress_pct: progressPct, updated_at: new Date().toISOString() })
          .eq("id", projectId);
      }

      return NextResponse.json({ success: true });
    }

    // 이슈 추가
    if (action === "addIssue") {
      const { title, description, severity } = data;
      if (!title) return NextResponse.json({ error: "제목 필요" }, { status: 400 });

      const { data: issue, error } = await supabase
        .from("project_issues")
        .insert({
          project_id: projectId,
          title,
          description: description || null,
          severity: severity || "medium",
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: "이슈 추가 실패" }, { status: 500 });

      await supabase.from("project_activities").insert({
        project_id: projectId,
        activity_type: "issue_created",
        description: `이슈 등록: ${title}`,
        actor: data.actor || "사업자",
      });

      return NextResponse.json({ issue }, { status: 201 });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (err) {
    console.error("Project PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
