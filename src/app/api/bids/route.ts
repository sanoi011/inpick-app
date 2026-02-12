import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 견적별 입찰 목록, 단일 입찰 조회, 또는 사업자별 입찰 목록
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const estimateId = request.nextUrl.searchParams.get("estimateId");
  const bidId = request.nextUrl.searchParams.get("id");
  const contractorId = request.nextUrl.searchParams.get("contractorId");
  const statusFilter = request.nextUrl.searchParams.get("status");

  if (bidId) {
    const { data, error } = await supabase
      .from("bids")
      .select(`
        *,
        specialty_contractors (
          *,
          contractor_trades (*),
          contractor_portfolio (*),
          contractor_reviews (*)
        )
      `)
      .eq("id", bidId)
      .single();

    if (error) {
      return NextResponse.json({ error: "입찰을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ bid: data });
  }

  // 사업자별 입찰 목록
  if (contractorId) {
    let query = supabase
      .from("bids")
      .select(`
        *,
        estimates (id, title, status, project_type, space_type, total_area_m2, grand_total, address)
      `)
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      return NextResponse.json({ error: "입찰 목록 조회 실패" }, { status: 500 });
    }
    return NextResponse.json({ bids: data || [] });
  }

  if (!estimateId) {
    return NextResponse.json({ error: "estimateId 또는 contractorId가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bids")
    .select(`
      *,
      specialty_contractors (
        id, company_name, contact_name, rating, total_reviews, completed_projects, is_verified,
        contractor_trades (trade_code, trade_name, experience_years),
        contractor_portfolio (id, title, project_type, image_urls, tags),
        contractor_reviews (id, rating, title, content, is_verified, created_at)
      )
    `)
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "입찰 목록 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ bids: data || [] });
}

// POST: 새 입찰 등록
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { estimateId, contractorId, bidAmount, discountRate, estimatedDays, startAvailableDate, message, metadata } = body;

    if (!estimateId || !contractorId || !bidAmount) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bids")
      .insert({
        estimate_id: estimateId,
        contractor_id: contractorId,
        bid_amount: bidAmount,
        discount_rate: discountRate || null,
        estimated_days: estimatedDays || 30,
        start_available_date: startAvailableDate || null,
        message: message || null,
        metadata: metadata || {},
        status: "pending",
      })
      .select(`
        *,
        specialty_contractors (id, company_name, contact_name, rating, total_reviews)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "이미 입찰한 업체입니다." }, { status: 409 });
      }
      return NextResponse.json({ error: "입찰 등록 실패" }, { status: 500 });
    }

    // 견적 상태를 BIDDING으로 업데이트
    await supabase
      .from("estimates")
      .update({ status: "in_progress" })
      .eq("id", estimateId)
      .in("status", ["draft", "confirmed"]);

    // 소비자 알림: 새 입찰 도착
    try {
      const { data: estimate } = await supabase
        .from("estimates")
        .select("user_id, consumer_project_id")
        .eq("id", estimateId)
        .single();
      if (estimate?.user_id) {
        const companyName = data.specialty_contractors?.company_name || "업체";
        await supabase.from("consumer_notifications").insert({
          user_id: estimate.user_id,
          type: "BID_RECEIVED",
          title: "새 입찰이 도착했습니다",
          message: `${companyName}에서 입찰서를 보냈습니다`,
          priority: "HIGH",
          link: estimate.consumer_project_id
            ? `/project/${estimate.consumer_project_id}/rfq`
            : undefined,
          reference_id: data.id,
        });
      }
    } catch { /* silent */ }

    return NextResponse.json({ bid: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "입찰 등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 입찰 상태 변경 (선정/미선정)
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id와 status가 필요합니다." }, { status: 400 });
    }

    if (!["pending", "selected", "rejected"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bids")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "입찰 상태 변경 실패" }, { status: 500 });
    }

    // 선정 시: 다른 입찰 미선정 처리 + 견적 상태 변경
    if (status === "selected") {
      await supabase
        .from("bids")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("estimate_id", data.estimate_id)
        .neq("id", id)
        .eq("status", "pending");

      await supabase
        .from("estimates")
        .update({ status: "completed" })
        .eq("id", data.estimate_id);
    }

    return NextResponse.json({ bid: data });
  } catch {
    return NextResponse.json({ error: "입찰 상태 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
