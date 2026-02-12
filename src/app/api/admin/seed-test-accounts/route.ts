import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 필요)" }, { status: 500 });
  }

  const results: {
    consumer: { success: boolean; email: string; password: string; userId?: string; credits?: number; error?: string };
    contractor: { success: boolean; email: string; companyName?: string; error?: string };
  } = {
    consumer: { success: false, email: "test@inpick.kr", password: "test1234!" },
    contractor: { success: false, email: "contractor@inpick.kr" },
  };

  // ─── 소비자 테스트 계정 ───
  try {
    const consumerEmail = "test@inpick.kr";
    const consumerPassword = "test1234!";

    // 기존 사용자 확인
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === consumerEmail);

    let userId: string;

    if (existing) {
      userId = existing.id;
      // 비밀번호 업데이트
      await supabase.auth.admin.updateUserById(userId, { password: consumerPassword });
    } else {
      // 새 사용자 생성
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: consumerEmail,
        password: consumerPassword,
        email_confirm: true,
        user_metadata: { full_name: "테스트 사용자" },
      });

      if (createError || !newUser.user) {
        results.consumer.error = createError?.message || "사용자 생성 실패";
        throw new Error(results.consumer.error);
      }
      userId = newUser.user.id;
    }

    // user_credits upsert (999999 크레딧)
    const { error: creditError } = await supabase
      .from("user_credits")
      .upsert({
        user_id: userId,
        balance: 999999,
        free_generations_used: 0,
      }, { onConflict: "user_id" });

    if (creditError) {
      results.consumer.error = `계정 생성됨, 크레딧 설정 실패: ${creditError.message}`;
    }

    results.consumer.success = true;
    results.consumer.userId = userId;
    results.consumer.credits = 999999;
  } catch (err) {
    if (!results.consumer.error) {
      results.consumer.error = err instanceof Error ? err.message : String(err);
    }
  }

  // ─── 사업자 테스트 계정 ───
  try {
    const contractorEmail = "contractor@inpick.kr";

    // 기존 사업자 확인
    const { data: existing } = await supabase
      .from("specialty_contractors")
      .select("id")
      .eq("email", contractorEmail)
      .single();

    if (existing) {
      // 활성 상태 업데이트
      await supabase
        .from("specialty_contractors")
        .update({ is_active: true, is_verified: true })
        .eq("id", existing.id);
    } else {
      // 새 사업자 생성
      const { error: insertError } = await supabase
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
        results.contractor.error = insertError.message;
        throw new Error(insertError.message);
      }
    }

    results.contractor.success = true;
    results.contractor.companyName = "테스트 인테리어";
  } catch (err) {
    if (!results.contractor.error) {
      results.contractor.error = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(results);
}
