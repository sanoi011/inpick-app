import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createResetToken } from "@/lib/contractor-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      // 이메일 존재 여부 노출 방지: 항상 동일 응답
      return NextResponse.json({ message: "비밀번호 재설정 이메일을 발송했습니다." });
    }

    const { data: contractor } = await supabase
      .from("specialty_contractors")
      .select("id, email, company_name")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (!contractor) {
      // 미등록 이메일에도 동일 성공 응답 (보안)
      return NextResponse.json({ message: "비밀번호 재설정 이메일을 발송했습니다." });
    }

    const token = createResetToken(contractor.id, contractor.email);
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "http://localhost:3000";
    const resetUrl = `${origin}/contractor/reset-password?token=${token}`;

    // 개발 단계: 콘솔 로그 + 응답에 포함 (프로덕션에서는 이메일 발송으로 교체)
    console.log(`[forgot-password] Reset URL for ${contractor.email}: ${resetUrl}`);

    return NextResponse.json({
      message: "비밀번호 재설정 이메일을 발송했습니다.",
      // 개발용: 프로덕션에서는 resetUrl 제거
      resetUrl,
    });
  } catch (err) {
    console.error("[forgot-password] Error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
