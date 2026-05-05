/**
 * POST /api/notifications/notify-consumer
 *
 * 사업자가 입찰 제출 등 액션 시 → 해당 견적의 소비자에게 알림 insert.
 * 입력: { estimateId, type, title, message, link? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  estimateId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.estimateId || !body.title) {
      return NextResponse.json({ error: "estimateId, title 필수" }, { status: 400 });
    }
    const admin = createAdminClient();

    // estimate에서 user_id 찾기
    const { data: est } = await admin
      .from("estimates")
      .select("id, user_id, consumer_project_id")
      .eq("id", body.estimateId)
      .maybeSingle();
    let userId: string | null = est?.user_id ?? null;

    // consumer_projects 거쳐서 user_id 찾기 (estimate에 user_id 없을 때)
    if (!userId && est?.consumer_project_id) {
      const { data: proj } = await admin
        .from("consumer_projects")
        .select("user_id")
        .eq("id", est.consumer_project_id)
        .maybeSingle();
      userId = proj?.user_id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ ok: false, reason: "수신자 user_id 못 찾음" }, { status: 200 });
    }

    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      type: body.type,
      title: body.title,
      message: body.message,
      link: body.link || `/mypage/contracts/progress?estimateId=${body.estimateId}`,
      is_read: false,
    });

    if (error) {
      // notifications 테이블 미존재 등 — 무시하고 200 반환 (입찰은 이미 성공)
      console.warn("[notify] insert error:", error);
      return NextResponse.json(
        { ok: false, reason: error.message },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
