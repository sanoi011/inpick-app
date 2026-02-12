import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: 물량산출 결과 로깅
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const {
      userId,
      projectId,
      estimateId,
      floorPlanData,
      demolitionScope,
      quantityResult,
      estimateResult,
      totalItems,
      grandTotal,
    } = body;

    if (!floorPlanData || !quantityResult || !estimateResult) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("quantity_calculations")
      .insert({
        user_id: userId || null,
        project_id: projectId || null,
        estimate_id: estimateId || null,
        floor_plan_data: floorPlanData,
        demolition_scope: demolitionScope || null,
        quantity_result: quantityResult,
        estimate_result: estimateResult,
        total_items: totalItems || 0,
        grand_total: grandTotal || 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Quantity log insert error:", error);
      return NextResponse.json({ error: "로깅 실패" }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Quantity log error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
