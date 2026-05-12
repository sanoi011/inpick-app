import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

interface SignupBody {
  email: string;
  password: string;
  name: string;
  phone: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeAge14: boolean;
  agreeMarketing?: boolean;
  emailRedirectTo?: string;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function validate(body: Partial<SignupBody>): { ok: boolean; error?: string } {
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return { ok: false, error: "이메일 형식이 올바르지 않습니다." };
  }
  if (!body.password || body.password.length < 8) {
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  }
  const pw = body.password;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  if (!hasLetter || !hasDigit) {
    return { ok: false, error: "비밀번호는 영문과 숫자를 모두 포함해야 합니다." };
  }
  if (!body.name || body.name.trim().length < 2) {
    return { ok: false, error: "이름을 2자 이상 입력해주세요." };
  }
  if (!body.phone) {
    return { ok: false, error: "휴대폰번호를 입력해주세요." };
  }
  const phone = normalizePhone(body.phone);
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return { ok: false, error: "휴대폰번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)" };
  }
  if (!body.agreeTerms || !body.agreePrivacy || !body.agreeAge14) {
    return { ok: false, error: "필수 약관에 모두 동의해주세요." };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  let body: Partial<SignupBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const v = validate(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const email = body.email!.toLowerCase().trim();
  const name = body.name!.trim();
  const phone = normalizePhone(body.phone!);
  const now = new Date().toISOString();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) 휴대폰 중복 사전 체크
  const { data: dupPhone, error: dupErr } = await admin
    .from("consumer_profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (dupErr) {
    console.error("[signup] phone lookup error:", dupErr.message);
    return NextResponse.json({ error: "휴대폰번호 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (dupPhone) {
    return NextResponse.json(
      { error: "이미 가입된 휴대폰번호입니다. 로그인하거나 비밀번호 찾기를 이용해주세요." },
      { status: 409 }
    );
  }

  // 2) 이메일 중복 사전 체크 (consumer_profiles + auth.users)
  const { data: dupEmail } = await admin
    .from("consumer_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (dupEmail) {
    return NextResponse.json(
      { error: "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요." },
      { status: 409 }
    );
  }

  // 3) Supabase Auth signUp — 이메일 확인 메일 자동 발송
  const { data: signUpData, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: false, // 이메일 인증 후 활성화
    user_metadata: {
      full_name: name,
      account_type: "consumer",
      phone,
    },
  });
  if (signUpErr || !signUpData?.user) {
    const msg = signUpErr?.message ?? "회원가입에 실패했습니다.";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }
    console.error("[signup] createUser error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const userId = signUpData.user.id;

  // 4) 확인 메일 발송 (admin createUser는 메일 발송 안 함 → generateLink로 명시 발송)
  const redirectTo = body.emailRedirectTo || `${new URL(req.url).origin}/auth/callback`;
  const { error: linkErr } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: body.password!,
    options: { redirectTo },
  });
  if (linkErr) {
    console.warn("[signup] generateLink warning:", linkErr.message);
  }

  // 5) consumer_profiles INSERT — phone UNIQUE 위반 시 race condition 안전망
  const { error: profileErr } = await admin.from("consumer_profiles").insert({
    id: userId,
    email,
    name,
    phone,
    agreed_terms_at: body.agreeTerms ? now : null,
    agreed_privacy_at: body.agreePrivacy ? now : null,
    agreed_age14_at: body.agreeAge14 ? now : null,
    agreed_marketing_at: body.agreeMarketing ? now : null,
  });
  if (profileErr) {
    // race condition으로 phone 중복이 잡힌 경우 사용자 정리
    await admin.auth.admin.deleteUser(userId).catch((err) => {
      console.error("[signup] cleanup deleteUser error:", err);
    });
    if (profileErr.message.includes("uq_consumer_profiles_phone")) {
      return NextResponse.json(
        { error: "이미 가입된 휴대폰번호입니다." },
        { status: 409 }
      );
    }
    console.error("[signup] profile insert error:", profileErr.message);
    return NextResponse.json({ error: "프로필 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId,
    message:
      "회원가입이 완료되었습니다. 등록하신 이메일로 인증 메일을 발송했습니다. 받은 메일함에서 인증 링크를 클릭해주세요.",
  });
}
