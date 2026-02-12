import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const method = searchParams.get("method") || "";
  const offset = (page - 1) * limit;

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({
      logs: [], total: 0, page, limit,
      stats: { total: 0, methods: {}, avgConfidence: 0, avgProcessingTime: 0, highConfidence: 0, lowConfidence: 0 },
    });
  }

  let query = supabase
    .from("drawing_parse_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (method) {
    query = query.eq("parse_method", method);
  }

  const { data: logs, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 통계 계산
  const statsQuery = await supabase
    .from("drawing_parse_logs")
    .select("parse_method, confidence_score, processing_time_ms, room_count");

  const allLogs = statsQuery.data || [];
  const total = allLogs.length;
  const methods: Record<string, number> = {};
  let totalConfidence = 0;
  let totalTime = 0;
  let confidenceCount = 0;
  let timeCount = 0;

  for (const log of allLogs) {
    methods[log.parse_method] = (methods[log.parse_method] || 0) + 1;
    if (log.confidence_score != null) {
      totalConfidence += log.confidence_score;
      confidenceCount++;
    }
    if (log.processing_time_ms != null) {
      totalTime += log.processing_time_ms;
      timeCount++;
    }
  }

  const stats = {
    total,
    methods,
    avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    avgProcessingTime: timeCount > 0 ? Math.round(totalTime / timeCount) : 0,
    highConfidence: allLogs.filter((l) => l.confidence_score >= 0.8).length,
    lowConfidence: allLogs.filter((l) => l.confidence_score != null && l.confidence_score < 0.5).length,
  };

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    page,
    limit,
    stats,
  });
}
