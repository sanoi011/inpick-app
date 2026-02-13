import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ConstructionSchedule, PhaseSchedule, ScheduleTask } from "@/types/construction-schedule";
import { PHASE_GANTT_COLORS } from "@/types/construction-schedule";
import type { TradeCode } from "@/lib/floor-plan/quantity/types";
import { diffDays } from "@/lib/schedule/date-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const supabase = createClient();

    const { data: project, error } = await supabase
      .from("contractor_projects")
      .select("*, project_phases(*)")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });
    }

    if (!project.schedule_generated_at) {
      return NextResponse.json({ generated: false });
    }

    // schedule_tasks 조회
    const { data: tasks } = await supabase
      .from("schedule_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");

    const tasksByPhase: Record<string, ScheduleTask[]> = {};
    for (const t of tasks || []) {
      const phaseId = t.phase_id as string;
      if (!tasksByPhase[phaseId]) tasksByPhase[phaseId] = [];
      tasksByPhase[phaseId].push({
        id: t.id,
        phaseId: t.phase_id,
        projectId: t.project_id,
        tradeCode: t.trade_code as TradeCode,
        name: t.name,
        startDate: t.start_date,
        endDate: t.end_date,
        durationDays: t.duration_days || 1,
        sortOrder: t.sort_order || 0,
        status: mapStatus(t.status),
      });
    }

    const phases: PhaseSchedule[] = (project.project_phases as Record<string, unknown>[])
      .sort((a, b) => (a.phase_order as number) - (b.phase_order as number))
      .map((p) => ({
        id: p.id as string,
        name: p.name as string,
        phaseOrder: p.phase_order as number,
        status: mapStatus(p.status as string),
        startDate: p.start_date as string,
        endDate: p.end_date as string,
        durationDays: (p.duration_days as number) || 0,
        weight: (p.weight as number) || 0,
        tradeCodes: (p.trade_codes as TradeCode[]) || [],
        color: (p.color as string) || PHASE_GANTT_COLORS[(p.phase_order as number)] || "#6B7280",
        tasks: tasksByPhase[p.id as string] || [],
      }));

    const schedule: ConstructionSchedule = {
      projectId,
      projectName: project.name,
      startDate: project.start_date,
      endDate: project.end_date,
      totalDays: project.start_date && project.end_date
        ? diffDays(project.start_date, project.end_date) + 1
        : 0,
      phases,
      generatedAt: project.schedule_generated_at,
    };

    return NextResponse.json({ generated: true, schedule });
  } catch (err) {
    console.error("Schedule GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

function mapStatus(s: string): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" {
  switch (s) {
    case "in_progress": return "IN_PROGRESS";
    case "completed": return "COMPLETED";
    case "skipped": return "SKIPPED";
    default: return "PENDING";
  }
}
