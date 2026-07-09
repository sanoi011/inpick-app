import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 인증 확인: 본인만 삭제 가능
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: "자신의 계정만 삭제할 수 있습니다" }, { status: 403 });
    }

    // 1. 소비자 프로젝트 데이터 삭제 (soft delete - status 변경)
    await supabase
      .from("consumer_projects")
      .update({ status: "DELETED" })
      .eq("user_id", userId)
      .then(() => {});

    // 2. 크레딧 기록은 보존 (재무 기록 의무)

    // 3. Supabase Auth 사용자 삭제 — admin API는 service role 필수(세션 클라이언트는 항상 실패해
    //    "관리자 확인 후 처리" 폴백으로 빠졌었음 → Apple 5.1.1 계정삭제는 즉시 처리돼야 함)
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient =
      serviceUrl && serviceKey
        ? createServiceClient(serviceUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase;
    const { error: updateError } = await adminClient.auth.admin.deleteUser(userId);

    if (updateError) {
      // admin API 권한 없는 경우 — 사용자 메타데이터에 삭제 요청 기록
      await supabase.auth.updateUser({
        data: { deletion_requested: true, deletion_requested_at: new Date().toISOString() },
      });

      return NextResponse.json({
        success: true,
        message: "계정 삭제가 요청되었습니다. 관리자 확인 후 처리됩니다.",
        pending: true,
      });
    }

    return NextResponse.json({ success: true, message: "계정이 삭제되었습니다." });
  } catch (err) {
    console.error("Account delete error:", err);
    return NextResponse.json({ error: "계정 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
