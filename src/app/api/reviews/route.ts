import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 소비자 리뷰 작성
export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const { contractorId, contractId, rating, title, content } = body;
    const reviewerId = user.id;

    if (!contractorId || !rating || !content) {
      return NextResponse.json(
        { error: "contractorId, rating, content 필수" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "평점은 1~5 사이여야 합니다" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 중복 리뷰 방지: 같은 계약에 대해 이미 리뷰가 있는지 확인
    if (contractId) {
      const { data: existing } = await supabase
        .from("contractor_reviews")
        .select("id")
        .eq("contractor_id", contractorId)
        .eq("estimate_id", contractId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "이미 이 계약에 대한 리뷰를 작성하셨습니다" },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from("contractor_reviews")
      .insert({
        contractor_id: contractorId,
        reviewer_id: reviewerId || null,
        estimate_id: contractId || null,
        rating,
        title: title || null,
        content,
        is_verified: !!reviewerId,
      })
      .select()
      .single();

    if (error) {
      console.error("Review POST error:", error);
      return NextResponse.json({ error: "리뷰 등록 실패" }, { status: 500 });
    }

    // 업체 평점/리뷰수 업데이트
    const { data: allReviews } = await supabase
      .from("contractor_reviews")
      .select("rating")
      .eq("contractor_id", contractorId);

    if (allReviews && allReviews.length > 0) {
      const avg =
        allReviews.reduce((sum, r) => sum + ((r.rating as number) || 0), 0) /
        allReviews.length;

      await supabase
        .from("specialty_contractors")
        .update({
          rating: Math.round(avg * 10) / 10,
          total_reviews: allReviews.length,
        })
        .eq("id", contractorId);
    }

    // 사업자 알림
    await supabase.from("contractor_notifications").insert({
      contractor_id: contractorId,
      type: "REVIEW",
      title: "새 리뷰가 등록되었습니다",
      message: `${rating}점 리뷰: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
      priority: "normal",
      link: "/contractor/profile",
    });

    return NextResponse.json({ review: data }, { status: 201 });
  } catch (err) {
    console.error("Review POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// 특정 계약에 대한 리뷰 존재 여부 확인
export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  const contractId = req.nextUrl.searchParams.get("contractId");

  if (!contractorId || !contractId) {
    return NextResponse.json(
      { error: "contractorId, contractId 필수" },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("contractor_reviews")
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("estimate_id", contractId)
      .maybeSingle();

    return NextResponse.json({ review: data || null });
  } catch (err) {
    console.error("Review GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
