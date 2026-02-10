import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
