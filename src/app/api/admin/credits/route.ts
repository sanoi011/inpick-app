import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// 관리자 API는 RLS 바이패스를 위해 service role key 우선 사용
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return createServiceClient(url, serviceKey);
  return createClient();
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") || "users";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    if (view === "transactions") {
      const typeFilter = searchParams.get("type");
      let query = supabase
        .from("credit_transactions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (typeFilter) {
        query = query.eq("type", typeFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return NextResponse.json({ transactions: data || [], total: count || 0, page, limit });
    }

    // users view
    const { data, count, error } = await supabase
      .from("user_credits")
      .select("*", { count: "exact" })
      .order("balance", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // 합계
    const { data: allCredits } = await supabase.from("user_credits").select("balance, free_generations_used");
    const summary = {
      totalBalance: (allCredits || []).reduce((s: number, r: { balance: number }) => s + r.balance, 0),
      totalFreeUsed: (allCredits || []).reduce((s: number, r: { free_generations_used: number }) => s + r.free_generations_used, 0),
      userCount: allCredits?.length || 0,
    };

    // 트랜잭션 타입별 합계
    const { data: txSummary } = await supabase
      .from("credit_transactions")
      .select("type, amount");

    const txByType: Record<string, number> = {};
    (txSummary || []).forEach((tx: { type: string; amount: number }) => {
      txByType[tx.type] = (txByType[tx.type] || 0) + tx.amount;
    });

    return NextResponse.json({
      credits: data || [],
      total: count || 0,
      page,
      limit,
      summary: { ...summary, txByType },
    });
  } catch (err) {
    console.error("Admin credits error:", err);
    return NextResponse.json({ error: "크레딧 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const { userId, amount, type, description } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json({ error: "userId, amount 필수" }, { status: 400 });
    }

    // 잔액 조회 (없으면 자동 생성)
    const { data: current } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    let newBalance: number;

    if (!current) {
      // user_credits 레코드가 없으면 새로 생성
      newBalance = Math.max(0, amount);
      const { error: insertErr } = await supabase
        .from("user_credits")
        .insert({ user_id: userId, balance: newBalance, free_generations_used: 0 });
      if (insertErr) {
        return NextResponse.json({ error: `크레딧 레코드 생성 실패: ${insertErr.message}` }, { status: 500 });
      }
    } else {
      newBalance = current.balance + amount;
      await supabase
        .from("user_credits")
        .update({ balance: newBalance })
        .eq("user_id", userId);
    }

    // 트랜잭션 기록
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount,
      type: type || "CHARGE",
      description: description || `관리자 수동 조정 (${amount > 0 ? "+" : ""}${amount})`,
    });

    return NextResponse.json({ success: true, newBalance });
  } catch (err) {
    console.error("Admin credit adjust error:", err);
    return NextResponse.json({ error: "크레딧 조정 실패" }, { status: 500 });
  }
}
