import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contractor_reviews")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "리뷰 조회 실패" }, { status: 500 });
    }

    // 평균 평점 계산
    const reviews = data || [];
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + ((r.overall_rating as number) || (r.rating as number) || 0), 0) / reviews.length
      : 0;

    return NextResponse.json({
      reviews,
      stats: {
        totalReviews: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (err) {
    console.error("Reviews GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// 업체 답변 등록
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewId, contractorId, responseContent } = body;

    if (!reviewId || !contractorId || !responseContent) {
      return NextResponse.json({ error: "reviewId, contractorId, responseContent 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 리뷰 소유권 검증
    const { data: review } = await supabase
      .from("contractor_reviews")
      .select("contractor_id")
      .eq("id", reviewId)
      .single();

    if (!review || review.contractor_id !== contractorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { error } = await supabase
      .from("contractor_reviews")
      .update({
        response_content: responseContent,
        response_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (error) {
      console.error("Review response error:", error);
      return NextResponse.json({ error: "답변 등록 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reviews POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
