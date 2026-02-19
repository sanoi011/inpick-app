import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 결제/크레딧 이력 조회
export async function GET(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다" },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") || "all"; // all | CHARGE | SPEND
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = 20;

  try {
    let query = supabase
      .from("credit_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (type !== "all") {
      query = query.eq("type", type);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Payment history error:", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    // Current balance
    const { data: credits } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      transactions: (data || []).map(
        (t: Record<string, unknown>) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          metadata: t.metadata,
          createdAt: t.created_at,
        })
      ),
      currentBalance: credits?.balance || 0,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (err) {
    console.error("Payment history GET error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
