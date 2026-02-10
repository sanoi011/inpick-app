import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 마감재에 대한 선행공정 자동 매핑 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const finishItemId = request.nextUrl.searchParams.get("finishItemId");

  if (!finishItemId) {
    return NextResponse.json({ error: "마감재 ID가 필요합니다." }, { status: 400 });
  }

  // 선행공정 매핑 조회
  const { data: prereqs, error: prereqErr } = await supabase
    .from("finish_prereq_mapping")
    .select(`
      id, is_required, sort_order, notes,
      prerequisite_processes(id, code, name, unit, unit_cost, description, typical_duration_hours)
    `)
    .eq("finish_item_id", finishItemId)
    .order("sort_order");

  if (prereqErr) {
    return NextResponse.json({ error: "선행공정 조회 실패" }, { status: 500 });
  }

  // 부자재 매핑 조회
  const { data: submaterials, error: submatErr } = await supabase
    .from("finish_submaterial_mapping")
    .select(`
      id, quantity_per_unit, is_required, notes,
      sub_materials(id, code, name, unit, unit_price, description)
    `)
    .eq("finish_item_id", finishItemId);

  if (submatErr) {
    return NextResponse.json({ error: "부자재 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({
    finishItemId,
    prerequisites: prereqs || [],
    subMaterials: submaterials || [],
  });
}
