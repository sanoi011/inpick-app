import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
    }

    // 관리자 비밀번호 확인 (환경변수 기반)
    const adminPassword = process.env.ADMIN_PASSWORD || "inpick2026!";

    if (password !== adminPassword) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    // DB에서 관리자 프로필 확인
    const supabase = createClient();
    const { data: admin, error } = await supabase
      .from("admin_profiles")
      .select("id, email, name, role, is_active")
      .eq("email", email)
      .eq("is_active", true)
      .single();

    if (error || !admin) {
      return NextResponse.json({ error: "등록되지 않은 관리자입니다." }, { status: 401 });
    }

    // 마지막 로그인 시간 업데이트
    await supabase
      .from("admin_profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", admin.id);

    // 간단한 토큰 생성 (프로덕션에서는 JWT 사용 권장)
    const token = Buffer.from(`${admin.id}:${admin.email}:${Date.now()}`).toString("base64");

    return NextResponse.json({
      token,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
