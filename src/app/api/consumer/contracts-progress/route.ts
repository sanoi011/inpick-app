/**
 * GET /api/consumer/contracts-progress?userId=...
 * 사용자가 제출한 견적 + 받은 입찰 list
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId 필수" }, { status: 400 });
    }
    const admin = createAdminClient();

    // 사용자 프로젝트의 견적
    const { data: estimates, error } = await admin
      .from("estimates")
      .select(
        "id, title, address, total_area_m2, grand_total, status, created_at, user_id, consumer_project_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (estimates || []).map((e) => e.id);
    if (ids.length === 0) {
      return NextResponse.json({ estimates: [] });
    }

    // 해당 견적에 들어온 입찰
    const { data: bids } = await admin
      .from("bids")
      .select(
        "id, estimate_id, contractor_id, bid_amount, estimated_days, start_available_date, message, status, created_at",
      )
      .in("estimate_id", ids);

    const contractorIds = Array.from(
      new Set((bids || []).map((b) => b.contractor_id).filter(Boolean)),
    );
    const { data: contractors } = contractorIds.length
      ? await admin
          .from("specialty_contractors")
          .select("id, company_name, rating, region")
          .in("id", contractorIds)
      : { data: [] };
    const contractorMap = new Map<string, { company_name: string; rating: number; region: string }>();
    for (const c of contractors || []) {
      contractorMap.set(c.id, {
        company_name: c.company_name || "",
        rating: c.rating || 0,
        region: c.region || "",
      });
    }

    // 견적별 입찰 묶기
    const bidsByEstimate: Record<string, typeof bids> = {};
    for (const b of bids || []) {
      if (!bidsByEstimate[b.estimate_id]) bidsByEstimate[b.estimate_id] = [];
      bidsByEstimate[b.estimate_id]!.push(b);
    }

    const result = (estimates || []).map((est) => ({
      ...est,
      bids: (bidsByEstimate[est.id] || []).map((b) => ({
        ...b,
        contractor: contractorMap.get(b.contractor_id) || undefined,
      })),
    }));

    return NextResponse.json({ estimates: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
