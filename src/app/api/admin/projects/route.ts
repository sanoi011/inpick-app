import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/projects?status=&page=&limit=&month=YYYY-MM
 * DELETE /api/admin/projects?id=...        — 단일 삭제
 * DELETE /api/admin/projects (body: {ids:[...]}) — 일괄 삭제
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");
  let ids: string[] = id ? [id] : [];

  if (!id) {
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown) => typeof x === "string");
    } catch {
      /* no body */
    }
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "id 또는 ids 배열 필요" }, { status: 400 });
  }

  try {
    await supabase
      .from("estimates")
      .update({ consumer_project_id: null })
      .in("consumer_project_id", ids)
      .then(() => {});

    const { data, error } = await supabase
      .from("consumer_projects")
      .delete()
      .in("id", ids)
      .select("id");

    if (error) {
      console.error("Admin delete projects error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: data?.length ?? 0,
      deletedIds: (data || []).map((d) => d.id),
    });
  } catch (err) {
    console.error("Admin delete projects error:", err);
    return NextResponse.json({ error: "프로젝트 삭제 중 오류" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const month = searchParams.get("month"); // YYYY-MM 형식
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("consumer_projects")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    // 월별 필터
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((s) => parseInt(s, 10));
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
      const end = new Date(Date.UTC(y, m, 1)).toISOString();
      query = query.gte("created_at", start).lt("created_at", end);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    // 월별 집계 (사이드바 필터에 표시)
    const { data: monthly } = await supabase
      .from("consumer_projects")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const monthCounts: Record<string, number> = {};
    for (const row of monthly || []) {
      const key = row.created_at.slice(0, 7);
      monthCounts[key] = (monthCounts[key] ?? 0) + 1;
    }

    return NextResponse.json({
      projects: data || [],
      total: count || 0,
      page,
      limit,
      monthCounts,
    });
  } catch (err) {
    console.error("Admin projects error:", err);
    return NextResponse.json({ error: "프로젝트 조회 실패" }, { status: 500 });
  }
}
