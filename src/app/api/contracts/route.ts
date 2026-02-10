import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 계약 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");
  const estimateId = request.nextUrl.searchParams.get("estimateId");

  if (id) {
    const { data, error } = await supabase
      .from("contracts")
      .select(`
        *,
        specialty_contractors (id, company_name, contact_name, phone, email, rating, total_reviews)
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ contract: data });
  }

  const query = supabase
    .from("contracts")
    .select(`
      id, estimate_id, bid_id, contractor_id, project_name, address,
      total_amount, status, start_date, expected_end_date, signed_at, created_at,
      specialty_contractors (id, company_name, contact_name, rating)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (estimateId) {
    query.eq("estimate_id", estimateId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "계약 목록 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ contracts: data || [] });
}

// POST: 입찰 선정 → 계약 생성
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { bidId, consultSessionId } = body;

    if (!bidId) {
      return NextResponse.json({ error: "bidId가 필요합니다." }, { status: 400 });
    }

    // 입찰 정보 조회
    const { data: bid, error: bidErr } = await supabase
      .from("bids")
      .select("*, estimates(*)")
      .eq("id", bidId)
      .single();

    if (bidErr || !bid) {
      return NextResponse.json({ error: "입찰을 찾을 수 없습니다." }, { status: 404 });
    }

    const estimate = bid.estimates;

    // AI 상담 로그 조회
    let consultSnapshot: unknown[] = [];
    if (consultSessionId) {
      const { data: session } = await supabase
        .from("consult_sessions")
        .select("messages")
        .eq("id", consultSessionId)
        .single();
      if (session?.messages) {
        consultSnapshot = session.messages as unknown[];
      }
    }

    // 결제 스케줄 생성 (10/30/30/30)
    const totalAmount = bid.bid_amount;
    const deposit = Math.round(totalAmount * 0.1);
    const mid1 = Math.round(totalAmount * 0.3);
    const mid2 = Math.round(totalAmount * 0.3);
    const final = totalAmount - deposit - mid1 - mid2;

    const progressPayments = [
      { phase: "착공", percentage: 10, amount: deposit, status: "PENDING" },
      { phase: "중도 1차 (철거/기초)", percentage: 30, amount: mid1, status: "PENDING" },
      { phase: "중도 2차 (마감)", percentage: 30, amount: mid2, status: "PENDING" },
      { phase: "잔금 (완공/검수)", percentage: 30, amount: final, status: "PENDING" },
    ];

    // 착공일 계산
    const startDate = bid.start_available_date || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const endDate = new Date(new Date(startDate).getTime() + bid.estimated_days * 86400000).toISOString().slice(0, 10);

    // 계약 생성
    const { data: contract, error: createErr } = await supabase
      .from("contracts")
      .insert({
        estimate_id: bid.estimate_id,
        bid_id: bidId,
        consumer_id: estimate?.user_id || null,
        contractor_id: bid.contractor_id,
        project_name: estimate?.title || "인테리어 공사",
        address: estimate?.address || "",
        total_amount: totalAmount,
        deposit_amount: deposit,
        progress_payments: progressPayments,
        final_payment: final,
        start_date: startDate,
        expected_end_date: endDate,
        consult_session_id: consultSessionId || null,
        consult_log_snapshot: consultSnapshot,
        status: "pending_signature",
      })
      .select(`
        *,
        specialty_contractors (id, company_name, contact_name, phone, email, rating)
      `)
      .single();

    if (createErr) {
      return NextResponse.json({ error: "계약 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ contract }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "계약 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 계약 업데이트 (서명, 상태 변경, 결제 진행)
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "계약 ID가 필요합니다." }, { status: 400 });
    }

    // 서명 처리
    if (updates.sign) {
      const signType = updates.sign; // 'consumer' | 'contractor'
      delete updates.sign;

      const { data: current } = await supabase
        .from("contracts")
        .select("consumer_signature, contractor_signature")
        .eq("id", id)
        .single();

      if (signType === "consumer") {
        updates.consumer_signature = new Date().toISOString();
      } else if (signType === "contractor") {
        updates.contractor_signature = new Date().toISOString();
      }

      // 양쪽 서명 완료 시
      const consumerSigned = signType === "consumer" || !!current?.consumer_signature;
      const contractorSigned = signType === "contractor" || !!current?.contractor_signature;
      if (consumerSigned && contractorSigned) {
        updates.signed_at = new Date().toISOString();
        updates.status = "signed";
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("contracts")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        specialty_contractors (id, company_name, contact_name, phone, email, rating)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: "계약 업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ contract: data });
  } catch {
    return NextResponse.json({ error: "계약 업데이트 중 오류가 발생했습니다." }, { status: 500 });
  }
}
