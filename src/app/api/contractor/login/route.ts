import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createToken, verifyPassword } from "@/lib/contractor-auth";

/**
 * POST /api/contractor/login
 *
 * 비밀번호 로그인은 저장된 bcrypt hash를 검증한다.
 * 비밀번호가 없는 OAuth 교환은 서버가 Supabase 세션과 이메일 소유권을 확인한다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    }

    if (!password) {
      const supabase = createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email || user.email.toLowerCase() !== email) {
        return NextResponse.json({ error: "인증된 OAuth 세션이 필요합니다." }, { status: 401 });
      }
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("specialty_contractors")
      .select("id, company_name, contact_name, email, region, rating, is_verified, is_active, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[contractor login] select error:", error);
      return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { error: "등록된 사업자 정보를 찾을 수 없습니다. 가입 페이지를 이용해주세요." },
        { status: 401 },
      );
    }
    if (!row.is_active) {
      return NextResponse.json({ error: "비활성화된 계정입니다." }, { status: 403 });
    }

    if (password) {
      if (!row.password_hash) {
        return NextResponse.json(
          { error: "OAuth 로그인 또는 비밀번호 재설정 후 이용해주세요." },
          { status: 403 },
        );
      }
      if (!(await verifyPassword(password, row.password_hash))) {
        return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }
    }

    const token = createToken(row.id, row.email);
    return NextResponse.json({
      token,
      contractor: {
        id: row.id,
        companyName: row.company_name,
        contactName: row.contact_name,
        email: row.email,
        region: row.region,
        rating: row.rating,
        isVerified: row.is_verified,
      },
    });
  } catch (err) {
    console.error("[contractor login] error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
