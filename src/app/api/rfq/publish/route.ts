/**
 * POST /api/rfq/publish
 *
 * 소비자가 견적·입찰 공고를 등록 → 지역 사업자에게 자동 알림 fanout
 *
 * 입력: { estimateId, region: { sido, gugun }, deadline, ... }
 * 동작:
 *  1. estimates.status = 'open' (rfq_published)
 *  2. specialty_contractors WHERE region matches → notifications insert
 *  3. 응답: { ok, fanoutCount }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  estimateId: string;
  noticeNo?: string;
  region: { sido: string; gugun: string; fullAddress?: string };
  deadlineAt: string;
  budgetWon?: number;
  spaceType?: string;
  exclusiveAreaM2?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.estimateId || !body.region?.sido) {
      return NextResponse.json(
        { error: "estimateId, region.sido 필수" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1) estimate 상태 업데이트 + RFQ 메타 저장
    const { error: estErr } = await admin
      .from("estimates")
      .update({
        status: "open",
        rfq_data: {
          noticeNo: body.noticeNo,
          publishedAt: new Date().toISOString(),
          deadlineAt: body.deadlineAt,
          region: body.region,
          spaceType: body.spaceType,
          exclusiveAreaM2: body.exclusiveAreaM2,
          budgetWon: body.budgetWon,
        },
      })
      .eq("id", body.estimateId)
      .eq("user_id", user.id);
    if (estErr) {
      return NextResponse.json(
        { error: "견적 상태 업데이트 실패", detail: estErr.message },
        { status: 500 },
      );
    }

    // 2) 지역 매칭 사업자 조회 — sido 또는 '전국' 사업자
    const sidoKeys = [
      body.region.sido,
      body.region.sido.replace(/(특별시|광역시|특별자치시|도|특별자치도)/g, ""),
      "전국",
      "all",
    ];
    const { data: contractors } = await admin
      .from("specialty_contractors")
      .select("id, email, company_name, region")
      .in("region", sidoKeys)
      .eq("is_active", true)
      .limit(500);

    const targets = contractors || [];

    // 3) notifications fanout (실패해도 RFQ 등록은 성공)
    let fanoutCount = 0;
    if (targets.length > 0) {
      const rows = targets.map((c) => ({
        user_id: c.id,
        type: "rfq_published",
        title: `새 입찰 공고 — ${body.region.sido} ${body.region.gugun}`,
        message: `${body.spaceType || "주거"} ${body.exclusiveAreaM2 ?? "?"}㎡ · 예산 ₩${(body.budgetWon ?? 0).toLocaleString()} · 마감 ${body.deadlineAt.slice(0, 10)}`,
        link: `/contractor/bids?estimateId=${body.estimateId}`,
        is_read: false,
        metadata: {
          estimateId: body.estimateId,
          noticeNo: body.noticeNo,
          region: body.region,
          deadlineAt: body.deadlineAt,
        },
      }));
      const { error: nErr } = await admin.from("notifications").insert(rows);
      if (!nErr) fanoutCount = rows.length;
      else console.warn("[rfq publish] notifications fanout fail:", nErr);
    }

    return NextResponse.json({
      ok: true,
      estimateId: body.estimateId,
      fanoutCount,
      targetContractors: targets.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
