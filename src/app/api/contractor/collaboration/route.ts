import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requesterId, targetId, projectId, message, proposedAmount, proposedStartDate, proposedEndDate } = body;

    if (!requesterId || !targetId) {
      return NextResponse.json({ error: "requesterId, targetId 필수" }, { status: 400 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("collaboration_requests")
      .insert({
        requester_id: requesterId,
        target_id: targetId,
        project_id: projectId || null,
        message: message || null,
        proposed_amount: proposedAmount || null,
        proposed_start_date: proposedStartDate || null,
        proposed_end_date: proposedEndDate || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Collaboration POST error:", error);
      return NextResponse.json({ error: "협업 요청 실패" }, { status: 500 });
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err) {
    console.error("Collaboration POST error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
