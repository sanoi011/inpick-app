/**
 * POST /api/bids/select
 * 소비자가 입찰 중 하나를 선정 → 해당 bid status='selected', 나머지 'rejected'
 * + 사업자 측 알림 insert
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { estimateId, bidId } = await req.json();
    if (!estimateId || !bidId) {
      return NextResponse.json({ error: "estimateId, bidId 필수" }, { status: 400 });
    }
    const admin = createAdminClient();

    // 선정한 bid → selected
    const { data: selected, error: selErr } = await admin
      .from("bids")
      .update({ status: "selected", selected_at: new Date().toISOString() })
      .eq("id", bidId)
      .select("id, contractor_id")
      .single();
    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }
    // 같은 견적의 나머지 bid → rejected
    await admin
      .from("bids")
      .update({ status: "rejected" })
      .eq("estimate_id", estimateId)
      .neq("id", bidId);
    // estimate status → selected
    await admin
      .from("estimates")
      .update({ status: "selected" })
      .eq("id", estimateId);

    // 사업자 알림 (실패 무시)
    try {
      await admin.from("notifications").insert({
        user_id: selected.contractor_id,
        type: "bid_selected",
        title: "입찰이 선정되었습니다",
        message: "소비자가 귀하의 입찰을 선정했습니다. 계약 단계로 진행됩니다.",
        link: `/contractor/bids?tab=mine`,
        is_read: false,
      });
    } catch {
      /* 알림 테이블 미존재 시 무시 */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
