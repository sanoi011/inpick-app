import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 소비자 프로젝트 ID로 기존 RFQ 제출 여부 확인 + 입찰 목록
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const consumerProjectId = request.nextUrl.searchParams.get("consumerProjectId");

  if (!consumerProjectId) {
    return NextResponse.json({ error: "consumerProjectId가 필요합니다." }, { status: 400 });
  }

  // 해당 프로젝트의 견적 조회
  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, title, status, grand_total, address, region, rfq_data, created_at")
    .eq("consumer_project_id", consumerProjectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }

  if (!estimate) {
    return NextResponse.json({ estimate: null, bids: [] });
  }

  // 해당 견적의 입찰 목록
  const { data: bids } = await supabase
    .from("bids")
    .select(`
      *,
      specialty_contractors (
        id, company_name, contact_name, rating, total_reviews, completed_projects, is_verified,
        contractor_trades (trade_code, trade_name, experience_years)
      )
    `)
    .eq("estimate_id", estimate.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ estimate, bids: bids || [] });
}

// POST: 소비자 RFQ 제출 → estimates에 저장 + 사업자 알림 발송
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { projectId, address, estimateData, rfqPreferences } = body;

    if (!projectId || !address || !estimateData) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 지역 추출 (예: "서울특별시 강남구 역삼동 123" → "서울 강남구")
    const roadAddr = address.roadAddress || "";
    const regionParts = roadAddr.split(" ");
    const region = regionParts.length >= 2
      ? `${regionParts[0].replace(/특별시|광역시|특별자치시|특별자치도/, "")} ${regionParts[1]}`
      : regionParts[0] || "전국";

    // 건물 유형 → 프로젝트 타입
    const buildingType = address.buildingType || "아파트";
    const projectType = buildingType.includes("상가") || buildingType.includes("오피스")
      ? "commercial"
      : "residential";

    // 견적 제목 생성
    const buildingName = address.buildingName || "";
    const title = buildingName
      ? `${buildingName} ${address.exclusiveArea}㎡ 인테리어`
      : `${region} ${address.exclusiveArea}㎡ ${buildingType} 인테리어`;

    // 1. estimates 테이블에 INSERT
    const { data: estimate, error: estError } = await supabase
      .from("estimates")
      .insert({
        title,
        status: "confirmed",
        project_type: projectType,
        total_area_m2: address.exclusiveArea || 0,
        total_material: estimateData.totalMaterialCost || 0,
        total_labor: estimateData.totalLaborCost || 0,
        total_overhead: estimateData.totalExpense || 0,
        grand_total: estimateData.grandTotal || 0,
        address: roadAddr,
        space_type: buildingType,
        region,
        consumer_project_id: projectId,
        rfq_data: {
          ...rfqPreferences,
          roomCount: address.roomCount,
          bathroomCount: address.bathroomCount,
          floor: address.floor,
          sentAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (estError || !estimate) {
      console.error("Estimate creation error:", estError);
      return NextResponse.json({ error: "견적요청 등록 실패" }, { status: 500 });
    }

    // 2. estimate_items 저장 (소비자 견적 항목 스냅샷)
    if (estimateData.items && estimateData.items.length > 0) {
      const items = estimateData.items.map((item: Record<string, unknown>, idx: number) => ({
        estimate_id: estimate.id,
        space_name: item.roomName || "",
        item_name: `${item.category || ""} - ${item.part || ""} - ${item.materialName || ""}`,
        unit: item.unit || "식",
        quantity: item.quantity || 1,
        material_cost: item.materialCost || 0,
        labor_cost: item.laborCost || 0,
        overhead_cost: item.expense || 0,
        subtotal: item.total || 0,
        sort_order: idx,
      }));

      await supabase.from("estimate_items").insert(items);
    }

    // 3. 지역 매칭 사업자에게 알림 발송
    let notifiedCount = 0;

    // 활성 사업자 조회 (지역 무관하게 모든 사업자에게 알림 - MVP)
    const { data: contractors } = await supabase
      .from("specialty_contractors")
      .select("id")
      .eq("is_active", true)
      .limit(50);

    if (contractors && contractors.length > 0) {
      const notifications = contractors.map((c) => ({
        contractor_id: c.id,
        type: "RFQ_NEW",
        title: "새 견적요청",
        message: `${title} - 총 ${Math.round((estimateData.grandTotal || 0) / 10000)}만원`,
        priority: "HIGH",
        is_read: false,
        link: "/contractor/bids",
        reference_id: estimate.id,
      }));

      const { error: notiError } = await supabase
        .from("contractor_notifications")
        .insert(notifications);

      if (!notiError) {
        notifiedCount = contractors.length;
      }
    }

    return NextResponse.json(
      { estimateId: estimate.id, status: "confirmed", notifiedContractors: notifiedCount },
      { status: 201 }
    );
  } catch (err) {
    console.error("RFQ submission error:", err);
    return NextResponse.json({ error: "견적요청 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
