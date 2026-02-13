import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 서비스 롤 키가 있으면 admin API, 없으면 일반 signUp 사용
  const serviceSupabase = getServiceSupabase();
  const anonSupabase = createClient();

  const results: {
    consumer: { success: boolean; email: string; password: string; userId?: string; credits?: number; error?: string; note?: string };
    contractor: { success: boolean; email: string; companyName?: string; error?: string };
  } = {
    consumer: { success: false, email: "test@inpick.kr", password: "test1234!" },
    contractor: { success: false, email: "contractor@inpick.kr" },
  };

  // ─── 소비자 테스트 계정 ───
  try {
    const consumerEmail = "test@inpick.kr";
    const consumerPassword = "test1234!";
    let userId: string | null = null;

    if (serviceSupabase) {
      // 서비스 롤 키 사용: admin API (이메일 확인 자동 완료)
      const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === consumerEmail);

      if (existing) {
        userId = existing.id;
        await serviceSupabase.auth.admin.updateUserById(userId, {
          password: consumerPassword,
          email_confirm: true,
          user_metadata: { full_name: "테스트 사용자" },
        });
      } else {
        const { data: newUser, error: createError } = await serviceSupabase.auth.admin.createUser({
          email: consumerEmail,
          password: consumerPassword,
          email_confirm: true,
          user_metadata: { full_name: "테스트 사용자" },
        });
        if (createError || !newUser.user) {
          throw new Error(createError?.message || "사용자 생성 실패");
        }
        userId = newUser.user.id;
      }
    } else {
      // Anon 키 사용: 일반 signUp (이메일 확인 필요할 수 있음)
      const { data: signUpData, error: signUpError } = await anonSupabase.auth.signUp({
        email: consumerEmail,
        password: consumerPassword,
        options: { data: { full_name: "테스트 사용자" } },
      });

      if (signUpError) {
        // "User already registered" 에러이면 기존 사용자
        if (signUpError.message.includes("already registered") || signUpError.message.includes("already been registered")) {
          // 기존 사용자 로그인 시도로 userId 획득
          const { data: loginData } = await anonSupabase.auth.signInWithPassword({
            email: consumerEmail,
            password: consumerPassword,
          });
          if (loginData?.user) {
            userId = loginData.user.id;
            await anonSupabase.auth.signOut();
          } else {
            results.consumer.note = "이미 가입된 계정. 비밀번호가 다를 수 있습니다.";
          }
        } else {
          throw new Error(signUpError.message);
        }
      } else if (signUpData?.user) {
        userId = signUpData.user.id;
        if (signUpData.user.identities?.length === 0) {
          results.consumer.note = "이미 가입된 이메일. 기존 비밀번호로 로그인하세요.";
        }
      }
    }

    // user_credits upsert (999999 크레딧)
    const db = serviceSupabase || anonSupabase;
    if (userId) {
      const { error: creditError } = await db
        .from("user_credits")
        .upsert({
          user_id: userId,
          balance: 999999,
          free_generations_used: 0,
        }, { onConflict: "user_id" });

      if (creditError) {
        results.consumer.error = `계정 생성됨, 크레딧 설정 실패: ${creditError.message}`;
      }
      results.consumer.userId = userId;
      results.consumer.credits = 999999;
    }

    results.consumer.success = true;
  } catch (err) {
    results.consumer.error = err instanceof Error ? err.message : String(err);
  }

  // ─── 사업자 테스트 계정 ───
  try {
    const contractorEmail = "contractor@inpick.kr";
    const db = serviceSupabase || anonSupabase;

    // 기존 사업자 확인
    const { data: existing } = await db
      .from("specialty_contractors")
      .select("id")
      .eq("email", contractorEmail)
      .single();

    if (existing) {
      await db
        .from("specialty_contractors")
        .update({ is_active: true, is_verified: true })
        .eq("id", existing.id);
    } else {
      const { error: insertError } = await db
        .from("specialty_contractors")
        .insert({
          company_name: "테스트 인테리어",
          contact_name: "테스트 담당자",
          phone: "010-0000-0000",
          email: contractorEmail,
          region: "seoul",
          address: "서울시 강남구 테스트로 1",
          rating: 4.5,
          total_reviews: 10,
          is_verified: true,
          is_active: true,
          metadata: { introduction: "테스트용 사업자 계정입니다.", registration_status: "approved" },
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    results.contractor.success = true;
    results.contractor.companyName = "테스트 인테리어";
  } catch (err) {
    results.contractor.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results);
}
