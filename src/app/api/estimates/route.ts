import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 견적 목록 조회 또는 단일 견적 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const { data: estimate, error } = await supabase
      .from("estimates")
      .select(`
        *,
        estimate_items(*),
        estimate_space_summary(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ estimate });
  }

  const { data: estimates, error } = await supabase
    .from("estimates")
    .select("id, title, status, project_type, total_area_m2, grand_total, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "견적 목록 조회 실패" }, { status: 500 });
  }
  return NextResponse.json({ estimates: estimates || [] });
}

// POST: 새 견적 생성 + 자동 계산
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { title, projectType, totalAreaM2, spaces } = body;

    if (!title || !projectType || !spaces || !Array.isArray(spaces)) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 1. 간접비율 조회
    const { data: overheadRates } = await supabase
      .from("overhead_rates")
      .select("code, rate_value, base")
      .eq("is_active", true);

    const rateMap = new Map<string, { rate: number; base: string }>();
    overheadRates?.forEach((r) => rateMap.set(r.code, { rate: r.rate_value, base: r.base }));

    // 2. 견적 생성
    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .insert({
        title,
        project_type: projectType,
        total_area_m2: totalAreaM2,
        status: "draft",
      })
      .select()
      .single();

    if (estError || !estimate) {
      return NextResponse.json({ error: "견적 생성 실패" }, { status: 500 });
    }

    let grandMaterial = 0;
    let grandLabor = 0;
    const allItems: Record<string, unknown>[] = [];
    const spaceSummaries: Record<string, unknown>[] = [];

    // 3. 공간별 아이템 처리
    for (const space of spaces) {
      const { spaceName, spaceTypeId, areaM2, items } = space;
      let spaceMaterial = 0;
      let spaceLabor = 0;

      if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const materialCost = (item.materialUnitCost || 0) * (item.quantity || 1);
          const laborCost = (item.laborUnitCost || 0) * (item.quantity || 1);

          // 간접비 계산: (자재비+노무비) × 경비율
          const expenseRate = rateMap.get("OH-EXP")?.rate || 7;
          const overheadCost = (materialCost + laborCost) * (expenseRate / 100);

          const subtotal = materialCost + laborCost + overheadCost;

          spaceMaterial += materialCost;
          spaceLabor += laborCost;

          allItems.push({
            estimate_id: estimate.id,
            space_type_id: spaceTypeId || null,
            finish_item_id: item.finishItemId || null,
            space_name: spaceName,
            item_name: item.name,
            unit: item.unit || "식",
            quantity: item.quantity || 1,
            material_cost: materialCost,
            labor_cost: laborCost,
            overhead_cost: overheadCost,
            subtotal,
            sort_order: i,
          });
        }
      }

      const spaceExpense = (spaceMaterial + spaceLabor) * ((rateMap.get("OH-EXP")?.rate || 7) / 100);
      const spaceTotal = spaceMaterial + spaceLabor + spaceExpense;

      grandMaterial += spaceMaterial;
      grandLabor += spaceLabor;

      spaceSummaries.push({
        estimate_id: estimate.id,
        space_type_id: spaceTypeId || null,
        space_name: spaceName,
        area_m2: areaM2 || 0,
        material_total: spaceMaterial,
        labor_total: spaceLabor,
        overhead_total: spaceExpense,
        space_total: spaceTotal,
      });
    }

    // 4. 간접비 상세 계산 (명세서 기준)
    const directLabor = grandLabor;
    const indirectLabor = directLabor * ((rateMap.get("OH-IND")?.rate || 14.5) / 100);
    const totalLabor = directLabor + indirectLabor;

    // 4대보험
    const insurance =
      totalLabor * ((rateMap.get("OH-SAN")?.rate || 3.7) / 100) +
      totalLabor * ((rateMap.get("OH-NHI")?.rate || 3.545) / 100) +
      totalLabor * ((rateMap.get("OH-NPS")?.rate || 4.5) / 100) +
      totalLabor * ((rateMap.get("OH-EMP")?.rate || 1.15) / 100);

    const retirement = directLabor * ((rateMap.get("OH-RET")?.rate || 2.3) / 100);
    const expense = (grandMaterial + totalLabor) * ((rateMap.get("OH-EXP")?.rate || 7) / 100);
    const safety = (grandMaterial + totalLabor) * ((rateMap.get("OH-SAF")?.rate || 2.93) / 100);
    const environment = (grandMaterial + totalLabor) * ((rateMap.get("OH-ENV")?.rate || 0.5) / 100);

    const netConstruction = grandMaterial + totalLabor + insurance + retirement + expense + safety + environment;
    const generalAdmin = netConstruction * ((rateMap.get("OH-GNA")?.rate || 6) / 100);
    const profit = (totalLabor + expense + generalAdmin) * ((rateMap.get("OH-PRF")?.rate || 15) / 100);

    const totalBeforeTax = netConstruction + generalAdmin + profit;
    const vat = totalBeforeTax * ((rateMap.get("OH-VAT")?.rate || 10) / 100);
    const grandTotal = totalBeforeTax + vat;

    const totalOverhead = grandTotal - grandMaterial - directLabor;

    // 5. DB에 아이템 및 요약 저장
    if (allItems.length > 0) {
      await supabase.from("estimate_items").insert(allItems);
    }
    if (spaceSummaries.length > 0) {
      await supabase.from("estimate_space_summary").insert(spaceSummaries);
    }

    // 6. 견적 총합 업데이트
    const { data: updated, error: updateErr } = await supabase
      .from("estimates")
      .update({
        total_material: grandMaterial,
        total_labor: directLabor,
        total_overhead: totalOverhead,
        grand_total: grandTotal,
        metadata: {
          calculation: {
            directLabor,
            indirectLabor,
            totalLabor,
            insurance,
            retirement,
            expense,
            safety,
            environment,
            netConstruction,
            generalAdmin,
            profit,
            totalBeforeTax,
            vat,
            grandTotal,
          },
        },
      })
      .eq("id", estimate.id)
      .select(`
        *,
        estimate_items(*),
        estimate_space_summary(*)
      `)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "견적 업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ estimate: updated }, { status: 201 });
  } catch (err) {
    console.error("Estimate creation error:", err);
    return NextResponse.json({ error: "견적 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 견적 수정
export async function PATCH(request: NextRequest) {
  const supabase = createClient();

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "견적 ID가 필요합니다." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("estimates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "견적 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ estimate: data });
  } catch (err) {
    console.error("Estimate update error:", err);
    return NextResponse.json({ error: "견적 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
