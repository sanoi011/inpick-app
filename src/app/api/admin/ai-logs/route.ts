import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const agentType = searchParams.get("agentType");
  const hasRating = searchParams.get("hasRating");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("ai_conversations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }
    if (hasRating === "true") {
      query = query.not("rating", "is", null);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Admin AI logs error:", err);
    return NextResponse.json({ error: "AI 로그 조회 실패" }, { status: 500 });
  }
}
