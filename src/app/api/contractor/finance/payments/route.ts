import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractorIdFromRequest } from "@/lib/contractor-auth";

export async function GET(req: NextRequest) {
  try {
    const contractorId = req.nextUrl.searchParams.get("contractorId");
    const from = req.nextUrl.searchParams.get("from");

    if (!contractorId) {
      return NextResponse.json({ error: "contractorId 필수" }, { status: 400 });
    }

    const authId = getContractorIdFromRequest(req);
    if (authId && authId !== contractorId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const supabase = createClient();

    let query = supabase
      .from("payment_records")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("paid_at", { ascending: false });

    if (from) {
      query = query.gte("paid_at", from);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Payment GET error:", error);
      return NextResponse.json({ error: "결제 기록 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ payments: data || [] });
  } catch (err) {
    console.error("Payment GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, invoiceId, projectId, amount, paymentMethod, paymentType, description } = body;

    if (!contractorId || !amount) {
      return NextResponse.json({ error: "contractorId, amount 필수" }, { status: 400 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("payment_records")
      .insert({
        contractor_id: contractorId,
        invoice_id: invoiceId || null,
        project_id: projectId || null,
        amount,
        payment_method: paymentMethod || "bank_transfer",
        payment_type: paymentType || "income",
        description: description || null,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Payment POST error:", error);
      return NextResponse.json({ error: "결제 기록 실패" }, { status: 500 });
    }

    // 청구서 상태 업데이트
    if (invoiceId) {
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoiceId);
    }

    return NextResponse.json({ payment: data }, { status: 201 });
  } catch (err) {
    console.error("Payment POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
