import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  const startDate = req.nextUrl.searchParams.get("startDate");
  const endDate = req.nextUrl.searchParams.get("endDate");

  try {
    const supabase = createClient();
    let query = supabase
      .from("contractor_schedules")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("date", { ascending: true });

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);

    const { data, error } = await query.limit(200);

    if (error) {
      console.error("Schedule GET error:", error);
      return NextResponse.json({ error: "일정 조회 실패" }, { status: 500 });
    }

    // 충돌 감지
    const schedules = data || [];
    const conflicts: { date: string; items: string[] }[] = [];
    const byDate = new Map<string, typeof schedules>();
    for (const s of schedules) {
      const arr = byDate.get(s.date) || [];
      arr.push(s);
      byDate.set(s.date, arr);
    }

    const dateEntries = Array.from(byDate.entries());
    for (const [date, items] of dateEntries) {
      if (items.length < 2) continue;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          if (a.start_time && b.start_time && a.end_time && b.end_time) {
            if (a.start_time < b.end_time && b.start_time < a.end_time) {
              conflicts.push({ date, items: [a.id, b.id] });
            }
          }
        }
      }
    }

    return NextResponse.json({ schedules, conflicts });
  } catch (err) {
    console.error("Schedule GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, title, date, startTime, endTime, scheduleType, projectId, location, workers, notes, color } = body;

    if (!contractorId || !date) {
      return NextResponse.json({ error: "contractorId, date 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 시간 충돌 검증
    if (startTime && endTime) {
      const { data: existing } = await supabase
        .from("contractor_schedules")
        .select("id, start_time, end_time, title")
        .eq("contractor_id", contractorId)
        .eq("date", date)
        .not("start_time", "is", null)
        .not("end_time", "is", null);

      if (existing) {
        const conflict = existing.find(
          (e) => e.start_time < endTime && startTime < e.end_time
        );
        if (conflict) {
          return NextResponse.json(
            { error: `시간 충돌: "${conflict.title || "기존 일정"}"과 겹칩니다`, conflictId: conflict.id },
            { status: 409 }
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("contractor_schedules")
      .insert({
        contractor_id: contractorId,
        title: title || null,
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        schedule_type: scheduleType || "project",
        status: "scheduled",
        project_id: projectId || null,
        location: location || null,
        workers: workers || [],
        notes: notes || null,
        color: color || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Schedule POST error:", error);
      return NextResponse.json({ error: "일정 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (err) {
    console.error("Schedule POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, contractorId, ...updates } = body;

    if (!id || !contractorId) {
      return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 소유권 확인
    const { data: existing } = await supabase
      .from("contractor_schedules")
      .select("contractor_id")
      .eq("id", id)
      .single();

    if (!existing || existing.contractor_id !== contractorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.date) dbUpdates.date = updates.date;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.scheduleType) dbUpdates.schedule_type = updates.scheduleType;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.workers !== undefined) dbUpdates.workers = updates.workers;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    const { error } = await supabase
      .from("contractor_schedules")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "일정 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Schedule PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, contractorId } = await req.json();

    if (!id || !contractorId) {
      return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
    }

    const supabase = createClient();

    const { data: existing } = await supabase
      .from("contractor_schedules")
      .select("contractor_id")
      .eq("id", id)
      .single();

    if (!existing || existing.contractor_id !== contractorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { error } = await supabase
      .from("contractor_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "일정 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Schedule DELETE error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
