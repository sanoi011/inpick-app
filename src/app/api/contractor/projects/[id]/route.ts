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

      // 공정명 조회 (알림용)
      const { data: phaseRow } = await supabase
        .from("project_phases")
        .select("name, phase_order")
        .eq("id", phaseId)
        .single();

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

        // 소비자 알림: 공정 상태 변경 시
        if (phaseStatus && phaseRow) {
          try {
            const { data: project } = await supabase
              .from("contractor_projects")
              .select("contract_id, name")
              .eq("id", projectId)
              .single();

            if (project?.contract_id) {
              const { data: contract } = await supabase
                .from("contracts")
                .select("consumer_id, bid_id")
                .eq("id", project.contract_id)
                .single();

              if (contract?.consumer_id) {
                const statusLabel = phaseStatus === "completed" ? "완료" : phaseStatus === "in_progress" ? "진행중" : "대기";
                await supabase.from("consumer_notifications").insert({
                  user_id: contract.consumer_id,
                  type: "PROJECT_UPDATE",
                  title: `${phaseRow.name} 공정 ${statusLabel}`,
                  message: `${project.name}: ${phaseRow.name} 공정이 ${statusLabel}되었습니다 (${completed}/${phases.length} 완료)`,
                  priority: phaseStatus === "completed" ? "MEDIUM" : "LOW",
                  link: `/contract/${contract.bid_id}`,
                  reference_id: project.contract_id,
                });
              }
            }
          } catch { /* 알림 실패는 무시 */ }
        }
      }

      return NextResponse.json({ success: true });
    }

    // 공정 사진 추가
    if (action === "addPhasePhoto") {
      const { phaseId, photoUrl, fileName } = data;
      if (!phaseId || !photoUrl) return NextResponse.json({ error: "phaseId, photoUrl 필요" }, { status: 400 });

      const { data: phase } = await supabase
        .from("project_phases")
        .select("photos")
        .eq("id", phaseId)
        .single();

      const photos = Array.isArray(phase?.photos) ? [...phase.photos] : [];
      if (photos.length >= 5) {
        return NextResponse.json({ error: "사진은 최대 5장까지 가능합니다" }, { status: 400 });
      }

      photos.push({ url: photoUrl, fileName: fileName || "", uploadedAt: new Date().toISOString() });

      await supabase
        .from("project_phases")
        .update({ photos, updated_at: new Date().toISOString() })
        .eq("id", phaseId);

      return NextResponse.json({ success: true, photos });
    }

    // 공정 사진 삭제
    if (action === "removePhasePhoto") {
      const { phaseId, photoIndex } = data;
      if (!phaseId || photoIndex === undefined) return NextResponse.json({ error: "phaseId, photoIndex 필요" }, { status: 400 });

      const { data: phase } = await supabase
        .from("project_phases")
        .select("photos")
        .eq("id", phaseId)
        .single();

      const photos = Array.isArray(phase?.photos) ? [...phase.photos] : [];
      if (photoIndex >= 0 && photoIndex < photos.length) {
        photos.splice(photoIndex, 1);
      }

      await supabase
        .from("project_phases")
        .update({ photos, updated_at: new Date().toISOString() })
        .eq("id", phaseId);

      return NextResponse.json({ success: true, photos });
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

    // 공정표 생성/재생성
    if (action === "generateSchedule") {
      const { data: project } = await supabase
        .from("contractor_projects")
        .select("*, project_phases(*)")
        .eq("id", projectId)
        .single();

      if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

      const phases = (project.project_phases as { id: string; phase_order: number }[])
        .sort((a, b) => a.phase_order - b.phase_order);

      if (!project.start_date || !project.end_date) {
        return NextResponse.json({ error: "시작일/종료일이 필요합니다" }, { status: 400 });
      }

      const { generateSchedule } = await import("@/lib/schedule/schedule-generator");
      const schedule = generateSchedule({
        projectId,
        projectName: project.name,
        startDate: project.start_date,
        endDate: project.end_date,
        existingPhaseIds: phases.map((p) => p.id),
      });

      // 기존 sub-task 삭제
      await supabase.from("schedule_tasks").delete().eq("project_id", projectId);

      // phase 업데이트 + sub-task 생성
      for (const phase of schedule.phases) {
        await supabase
          .from("project_phases")
          .update({
            start_date: phase.startDate,
            end_date: phase.endDate,
            duration_days: phase.durationDays,
            weight: phase.weight,
            trade_codes: phase.tradeCodes,
            color: phase.color,
          })
          .eq("id", phase.id);

        if (phase.tasks.length > 0) {
          const taskRows = phase.tasks.map((t) => ({
            phase_id: phase.id,
            project_id: projectId,
            trade_code: t.tradeCode,
            name: t.name,
            start_date: t.startDate,
            end_date: t.endDate,
            duration_days: t.durationDays,
            sort_order: t.sortOrder,
            status: "pending",
          }));
          await supabase.from("schedule_tasks").insert(taskRows);
        }
      }

      await supabase
        .from("contractor_projects")
        .update({ schedule_generated_at: new Date().toISOString() })
        .eq("id", projectId);

      await supabase.from("project_activities").insert({
        project_id: projectId,
        activity_type: "phase_update",
        description: "공정표가 생성되었습니다",
        actor: "시스템",
      });

      return NextResponse.json({ schedule });
    }

    // 개별 공정 날짜 수동 변경
    if (action === "updatePhaseSchedule") {
      const { phaseId, startDate, endDate } = data;
      if (!phaseId || !startDate || !endDate) {
        return NextResponse.json({ error: "phaseId, startDate, endDate 필요" }, { status: 400 });
      }

      const { diffDays } = await import("@/lib/schedule/date-utils");
      const duration = diffDays(startDate, endDate) + 1;

      await supabase
        .from("project_phases")
        .update({
          start_date: startDate,
          end_date: endDate,
          duration_days: duration,
        })
        .eq("id", phaseId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (err) {
    console.error("Project PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
