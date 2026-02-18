import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "all";
  const trade = sp.get("trade") || "";
  const region = sp.get("region") || "";
  const minRating = Number(sp.get("minRating")) || 0;
  const sort = sp.get("sort") || "relevance";
  const search = sp.get("search") || "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = 12;

  try {
    const supabase = createClient();

    // 기본 쿼리: 활성 + 공개 업체
    let query = supabase
      .from("specialty_contractors")
      .select(`
        id, company_name, contact_name, region, contractor_type,
        rating, total_reviews, completed_projects, is_verified,
        is_featured, subscription_tier, introduction, logo_url,
        min_project_budget, max_project_budget, created_at,
        contractor_trades(trade_code, trade_name, experience_years, is_primary),
        contractor_portfolio(image_urls)
      `, { count: "exact" })
      .eq("is_active", true)
      .eq("is_public", true);

    // 필터
    if (type !== "all") {
      query = query.eq("contractor_type", type);
    }
    if (region) {
      query = query.eq("region", region);
    }
    if (minRating > 0) {
      query = query.gte("rating", minRating);
    }
    if (search.trim()) {
      query = query.or(`company_name.ilike.%${search}%,introduction.ilike.%${search}%`);
    }

    // 정렬
    if (sort === "rating") {
      query = query.order("rating", { ascending: false });
    } else if (sort === "reviews") {
      query = query.order("total_reviews", { ascending: false });
    } else if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // 추천순: 프리미엄 → 평점
      query = query
        .order("is_featured", { ascending: false })
        .order("rating", { ascending: false });
    }

    // 페이지네이션
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Contractors list error:", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    // 공종 필터 (trade JOIN 후 클라이언트 측 필터링)
    let contractors = data || [];
    if (trade) {
      contractors = contractors.filter((c: Record<string, unknown>) => {
        const trades = c.contractor_trades as Record<string, unknown>[];
        return trades?.some((t) => t.trade_code === trade);
      });
    }

    // 응답 변환
    const mapped = contractors.map((c: Record<string, unknown>) => {
      const trades = (c.contractor_trades as Record<string, unknown>[]) || [];
      const portfolios = (c.contractor_portfolio as Record<string, unknown>[]) || [];
      const thumbnails: string[] = [];
      for (const p of portfolios) {
        const urls = p.image_urls as string[];
        if (urls?.length) thumbnails.push(urls[0]);
        if (thumbnails.length >= 3) break;
      }

      return {
        id: c.id,
        companyName: c.company_name,
        contactName: c.contact_name,
        region: c.region,
        contractorType: c.contractor_type || "specialty",
        rating: Number(c.rating) || 0,
        totalReviews: Number(c.total_reviews) || 0,
        completedProjects: Number(c.completed_projects) || 0,
        isVerified: c.is_verified,
        isFeatured: c.is_featured,
        subscriptionTier: c.subscription_tier || "free",
        introduction: c.introduction || "",
        logoUrl: c.logo_url,
        trades: trades.map((t) => ({
          code: t.trade_code,
          name: t.trade_name,
          experienceYears: Number(t.experience_years) || 0,
          isPrimary: t.is_primary,
        })),
        portfolioThumbnails: thumbnails,
        minProjectBudget: c.min_project_budget ? Number(c.min_project_budget) : undefined,
        maxProjectBudget: c.max_project_budget ? Number(c.max_project_budget) : undefined,
        createdAt: c.created_at,
      };
    });

    const total = count || 0;
    return NextResponse.json({
      contractors: mapped,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("Contractors GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
