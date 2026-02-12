import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
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
