import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") || "contracts";
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    if (view === "bids") {
      // 입찰 + estimate (의뢰자 정보) + contractor (사업자 정보) JOIN
      let query = supabase
        .from("bids")
        .select(
          `*,
          estimates ( id, address, region, total_estimate_won, status ),
          specialty_contractors ( id, company_name, region, rating, review_count )`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return NextResponse.json({ items: data || [], total: count || 0, page, limit });
    }

    // contracts view — estimate + bid + contractor FK 조인
    let query = supabase
      .from("contracts")
      .select(
        `*,
        estimates ( id, address, region, total_estimate_won, user_id ),
        bids ( id, bid_amount, start_available_date, duration_days ),
        specialty_contractors ( id, company_name, region, contact_name, rating )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error("Admin contracts error:", err);
    return NextResponse.json({ error: "계약/입찰 조회 실패" }, { status: 500 });
  }
}
