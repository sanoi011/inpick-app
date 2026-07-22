import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const supabase = createClient();

    const { data: contractor, error } = await supabase
      .from("specialty_contractors")
      .select(`
        id, company_name, contact_name, region,
        contractor_type, rating, total_reviews, completed_projects,
        is_verified, is_featured, subscription_tier, introduction,
        description, logo_url,
        min_project_budget, max_project_budget, created_at,
        contractor_trades(trade_code, trade_name, experience_years, is_primary),
        contractor_portfolio(id, title, description, project_type, completion_date, image_urls, tags),
        contractor_reviews(id, rating, title, content, is_verified, created_at)
      `)
      .eq("id", id)
      .eq("is_active", true)
      .eq("is_public", true)
      .single();

    if (error || !contractor) {
      return NextResponse.json({ error: "업체를 찾을 수 없습니다" }, { status: 404 });
    }

    // 조회수 증가 (fire-and-forget)
    supabase
      .from("specialty_contractors")
      .update({ view_count: (((contractor as Record<string, unknown>).view_count as number) || 0) + 1 })
      .eq("id", id)
      .then(() => {});

    return NextResponse.json({ contractor });
  } catch (err) {
    console.error("Contractor detail error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
