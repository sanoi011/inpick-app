import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE: 관리자 프로젝트 삭제
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  try {
    // 연결된 estimates의 consumer_project_id 정리
    await supabase
      .from("estimates")
      .update({ consumer_project_id: null })
      .eq("consumer_project_id", id)
      .then(() => {});

    const { data, error } = await supabase
      .from("consumer_projects")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Admin delete project error:", error);
      return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: data.id });
  } catch (err) {
    console.error("Admin delete project error:", err);
    return NextResponse.json({ error: "프로젝트 삭제 중 오류" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("consumer_projects")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      projects: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Admin projects error:", err);
    return NextResponse.json({ error: "프로젝트 조회 실패" }, { status: 500 });
  }
}
