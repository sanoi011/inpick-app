import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  const status = req.nextUrl.searchParams.get("status");

  try {
    const supabase = createClient();
    let query = supabase
      .from("invoices")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({ error: "청구서 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ invoices: data || [] });
  } catch (err) {
    console.error("Invoices GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, contractorId, status, dueDate } = body;

    if (!id || !contractorId) {
      return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
    }

    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태" }, { status: 400 });
    }

    const supabase = createClient();
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (dueDate !== undefined) updates.due_date = dueDate;
    if (status === "paid") updates.paid_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("contractor_id", contractorId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "청구서 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ invoice: data });
  } catch (err) {
    console.error("Invoice PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, projectId, contractId, description, amount } = body;

    if (!contractorId || !amount) {
      return NextResponse.json({ error: "contractorId, amount 필수" }, { status: 400 });
    }

    const supabase = createClient();

    // 자동 번호 생성: INV-YYYYMMDD-SEQ
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", contractorId)
      .like("invoice_number", `INV-${today}%`);

    const seq = String((count || 0) + 1).padStart(3, "0");
    const invoiceNumber = `INV-${today}-${seq}`;

    const tax = Math.round(amount * 0.1);
    const total = amount + tax;

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        contractor_id: contractorId,
        project_id: projectId || null,
        contract_id: contractId || null,
        invoice_number: invoiceNumber,
        description: description || null,
        amount,
        tax,
        total,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Invoice POST error:", error);
      return NextResponse.json({ error: "청구서 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ invoice: data }, { status: 201 });
  } catch (err) {
    console.error("Invoice POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
