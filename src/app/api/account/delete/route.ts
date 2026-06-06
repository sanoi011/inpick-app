import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // 3. Supabase Auth 사용자 삭제
    // 참고: service_role 키가 필요. 클라이언트에서는 signOut만 가능
    // 관리자 API로 처리하거나, 사용자를 비활성화
    const { error: updateError } = await supabase.auth.admin.deleteUser(userId);

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
