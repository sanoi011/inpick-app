import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  const category = req.nextUrl.searchParams.get("category");
  const projectId = req.nextUrl.searchParams.get("projectId");

  try {
    const supabase = createClient();
    let query = supabase
      .from("expense_records")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("expense_date", { ascending: false });

    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: "지출 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ expenses: data || [] });
  } catch (err) {
    console.error("Expenses GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, contractorId, description, amount, category, expenseDate } = body;

    if (!id || !contractorId) {
      return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
    }

    const supabase = createClient();
    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (category !== undefined) updates.category = category;
    if (expenseDate !== undefined) updates.expense_date = expenseDate;

    const { data, error } = await supabase
      .from("expense_records")
      .update(updates)
      .eq("id", id)
      .eq("contractor_id", contractorId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "지출 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ expense: data });
  } catch (err) {
    console.error("Expense PATCH error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const contractorId = req.nextUrl.searchParams.get("contractorId");

  if (!id || !contractorId) {
    return NextResponse.json({ error: "id, contractorId 필수" }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("expense_records")
      .delete()
      .eq("id", id)
      .eq("contractor_id", contractorId);

    if (error) {
      return NextResponse.json({ error: "지출 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Expense DELETE error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractorId, projectId, category, description, amount, expenseDate, receiptUrl } = body;

    if (!contractorId || !description || !amount) {
      return NextResponse.json({ error: "contractorId, description, amount 필수" }, { status: 400 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("expense_records")
      .insert({
        contractor_id: contractorId,
        project_id: projectId || null,
        category: category || "other",
        description,
        amount,
        expense_date: expenseDate || new Date().toISOString().split("T")[0],
        receipt_url: receiptUrl || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Expense POST error:", error);
      return NextResponse.json({ error: "지출 등록 실패" }, { status: 500 });
    }

    return NextResponse.json({ expense: data }, { status: 201 });
  } catch (err) {
    console.error("Expense POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
