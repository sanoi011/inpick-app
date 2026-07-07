/**
 * GET /api/admin/contractor-notifications
 *
 * 관리자가 사업자 알림 전체를 모니터링 (응답률·읽음률 분석용).
 *
 * 쿼리:
 *  - contractorId?: 특정 사업자 알림만
 *  - isRead?: true/false (읽음 필터)
 *  - type?: 알림 종류
 *  - page, limit
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createServiceClient(url, key);
  return createClient();
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const supabase = getSupabase();
  const { searchParams } = request.nextUrl;
  const contractorId = searchParams.get("contractorId");
  const isReadParam = searchParams.get("isRead");
  const type = searchParams.get("type");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("contractor_notifications")
      .select(
        `*,
        specialty_contractors ( id, company_name, region )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (contractorId) query = query.eq("contractor_id", contractorId);
    if (type) query = query.eq("type", type);
    if (isReadParam === "true") query = query.eq("is_read", true);
    if (isReadParam === "false") query = query.eq("is_read", false);

    const { data, count, error } = await query;
    if (error) throw error;

    // 응답률 요약 통계
    const { count: totalCount } = await supabase
      .from("contractor_notifications")
      .select("id", { count: "exact", head: true });
    const { count: readCount } = await supabase
      .from("contractor_notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", true);

    return NextResponse.json({
      items: data || [],
      total: count || 0,
      page,
      limit,
      stats: {
        totalCount: totalCount || 0,
        readCount: readCount || 0,
        readRate: totalCount ? (readCount || 0) / totalCount : 0,
      },
    });
  } catch (err) {
    console.error("Admin contractor-notifications error:", err);
    return NextResponse.json(
      { error: "사업자 알림 조회 실패" },
      { status: 500 }
    );
  }
}
