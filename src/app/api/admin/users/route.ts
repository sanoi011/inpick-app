import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") || "consumer";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  try {
    if (type === "contractor") {
      let query = supabase
        .from("specialty_contractors")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return NextResponse.json({ users: data || [], total: count || 0, page, limit });
    }

    // Consumer: user_credits 테이블 기반
    const { data: credits, count, error } = await supabase
      .from("user_credits")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    // consumer_projects 카운트
    const userIds = (credits || []).map((c: { user_id: string }) => c.user_id);
    const projectCounts: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: projects } = await supabase
        .from("consumer_projects")
        .select("user_id")
        .in("user_id", userIds);
      (projects || []).forEach((p: { user_id: string }) => {
        projectCounts[p.user_id] = (projectCounts[p.user_id] || 0) + 1;
      });
    }

    const users = (credits || []).map((c: {
      id: string; user_id: string; balance: number;
      free_generations_used: number; created_at: string; updated_at: string;
    }) => ({
      id: c.user_id,
      balance: c.balance,
      freeGenerationsUsed: c.free_generations_used,
      projectCount: projectCounts[c.user_id] || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return NextResponse.json({ users, total: count || 0, page, limit });
  } catch (err) {
    console.error("Admin users error:", err);
    return NextResponse.json({ error: "사용자 조회 실패" }, { status: 500 });
  }
}
