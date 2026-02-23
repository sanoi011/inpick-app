import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyResetToken, hashPassword } from "@/lib/contractor-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const payload = verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "토큰이 만료되었거나 유효하지 않습니다." }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);

    const { error } = await supabase
      .from("specialty_contractors")
      .update({ password_hash: passwordHash })
      .eq("id", payload.sub)
      .eq("email", payload.email);

    if (error) {
      console.error("[reset-password] DB update error:", error);
      return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
    }

    console.log(`[reset-password] Password reset for contractor: ${payload.email}`);

    return NextResponse.json({ message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    console.error("[reset-password] Error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
