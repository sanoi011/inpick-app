/**
 * POST /api/rfq/publish
 *
 * 소비자가 견적·입찰 공고를 등록 → 지역 사업자에게 자동 알림 fanout
 *
 * 입력: { estimateId, region: { sido, gugun }, deadline, ... }
 * 동작:
 *  1. estimates.status = 'confirmed' (rfq_published)
 *  2. specialty_contractors WHERE region matches → notifications insert
 *  3. 응답: { ok, fanoutCount }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  /** 워크플로우 projectId 또는 기존 estimates.id (호환) */
  estimateId?: string;
  consumerProjectId?: string;
  noticeNo?: string;
  /** 객체 또는 문자열("대전 유성구") 모두 허용 */
  region: { sido: string; gugun?: string; fullAddress?: string } | string;
  deadlineAt: string;
  budgetWon?: number;
  spaceType?: string;
  exclusiveAreaM2?: number;
  addressText?: string;
  shortlistSize?: 3 | 5;
  preferredStart?: string;
  visitPreference?: string;
  notes?: string;
  drawingOptions?: string[];
  designRenders?: Array<{ roomName?: string; roomKey?: string; url: string; refinedUrl?: string }>;
}

/** region을 {sido,gugun}로 정규화 (문자열 "대전 유성구" → {sido:"대전", gugun:"유성구"}) */
function normalizeRegion(r: Body["region"]): { sido: string; gugun: string } {
  if (typeof r === "string") {
    const parts = r.trim().split(/\s+/);
    return { sido: parts[0] || "", gugun: parts.slice(1).join(" ") };
  }
  return { sido: r?.sido || "", gugun: r?.gugun || "" };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const region = normalizeRegion(body.region);
    const projectRef = body.consumerProjectId || body.estimateId;
    if (!region.sido) {
      return NextResponse.json({ error: "region 필수" }, { status: 400 });
    }

    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const admin = createAdminClient();
    const shortlistSize: 3 | 5 = body.shortlistSize === 5 ? 5 : 3;

    // 1) estimates 행 확보 — 없으면 생성(upsert). 워크플로우는 construction_estimates에만
    //    저장하므로 RFQ용 estimates 행이 없을 수 있음(2026-07-05 H2: 공고가 실제로 안 올라가던 원인).
    const rfqData = {
      noticeNo: body.noticeNo,
      publishedAt: new Date().toISOString(),
      deadlineAt: body.deadlineAt,
      region,
      spaceType: body.spaceType,
      exclusiveAreaM2: body.exclusiveAreaM2,
      budgetWon: body.budgetWon,
      shortlistSize,
      preferredStart: body.preferredStart,
      visitPreference: body.visitPreference,
      notes: body.notes?.slice(0, 2000),
      drawingOptions: Array.isArray(body.drawingOptions) ? body.drawingOptions.slice(0, 12) : [],
      designRenders: Array.isArray(body.designRenders)
        ? body.designRenders
            .filter((render) => render && typeof render.url === "string" && /^https?:\/\//i.test(render.url))
            .slice(0, 6)
            .map((render) => ({
              roomName: render.roomName || render.roomKey || "디자인 시안",
              url: render.url,
              refinedUrl: render.refinedUrl,
            }))
        : [],
      comparisonFields: ["total", "included_scope", "materials", "schedule", "warranty"],
      addressVisibility: "district_until_visit_confirmed",
    };

    let estimateId: string | null = null;
    // 기존 행 탐색: 명시 id → consumer_project_id
    if (projectRef && !projectRef.startsWith("temp-")) {
      const { data: byId } = await admin
        .from("estimates")
        .select("id")
        .eq("user_id", user.id)
        .or(`id.eq.${projectRef},consumer_project_id.eq.${projectRef}`)
        .maybeSingle();
      estimateId = (byId as { id: string } | null)?.id ?? null;
    }

    if (estimateId) {
      const { error: updErr } = await admin
        .from("estimates")
        .update({
          status: "confirmed",
          region: region.sido,
          space_type: body.spaceType ?? null,
          address: body.addressText ?? null,
          rfq_data: rfqData,
          consumer_project_id: body.consumerProjectId ?? projectRef ?? null,
        })
        .eq("id", estimateId)
        .eq("user_id", user.id);
      if (updErr) {
        return NextResponse.json({ error: "견적 상태 업데이트 실패", detail: updErr.message }, { status: 500 });
      }
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("estimates")
        .insert({
          user_id: user.id,
          title: `${region.sido} ${region.gugun} ${body.exclusiveAreaM2 ? `${Math.round(body.exclusiveAreaM2)}㎡ ` : ""}${body.spaceType || "인테리어"} 공사`.trim(),
          project_type: body.spaceType === "상업" ? "commercial" : "residential",
          status: "confirmed",
          region: region.sido,
          space_type: body.spaceType ?? null,
          total_area_m2: body.exclusiveAreaM2 ?? 0,
          grand_total: 0,
          address: body.addressText ?? null,
          rfq_data: rfqData,
          consumer_project_id: body.consumerProjectId ?? (projectRef && !projectRef.startsWith("temp-") ? projectRef : null),
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return NextResponse.json({ error: "견적 공고 생성 실패", detail: insErr?.message }, { status: 500 });
      }
      estimateId = (inserted as { id: string }).id;
    }

    // 2) 지역 매칭 사업자 조회 — 전체 발송 대신 인증·평점·실적 기반 shortlist
    const sidoKeys = [
      region.sido,
      region.sido.replace(/(특별시|광역시|특별자치시|도|특별자치도)/g, ""),
      "전국",
      "all",
    ];
    const { data: contractors } = await admin
      .from("specialty_contractors")
      .select(
        "id, email, company_name, region, rating, total_reviews, completed_projects, is_verified, is_public, min_project_budget, max_project_budget",
      )
      .in("region", sidoKeys)
      .eq("is_active", true)
      .limit(500);

    const eligible = (contractors || [])
      .map((contractor) => {
        const rating = Number(contractor.rating || 0);
        const reviews = Number(contractor.total_reviews || 0);
        const completed = Number(contractor.completed_projects || 0);
        const minBudget = Number(contractor.min_project_budget || 0);
        const maxBudget = Number(contractor.max_project_budget || 0);
        const budget = Number(body.budgetWon || 0);
        const budgetFit =
          budget <= 0 ||
          ((!minBudget || budget >= minBudget) && (!maxBudget || budget <= maxBudget));
        const local = contractor.region === region.sido;
        const score =
          (contractor.is_verified ? 500 : 0) +
          (contractor.is_public === false ? -1000 : 0) +
          rating * 50 +
          Math.min(reviews, 100) * 1.5 +
          Math.min(completed, 100) * 2 +
          (budgetFit ? 80 : -60) +
          (local ? 40 : 0);
        return { ...contractor, score, budgetFit };
      })
      .filter((contractor) => contractor.is_public !== false)
      .sort((a, b) => b.score - a.score);
    const targets = eligible.slice(0, shortlistSize);

    // shortlist를 RFQ 스냅샷에 남겨 이후 비교·감사에 같은 매칭 집합을 사용한다.
    if (estimateId) {
      await admin
        .from("estimates")
        .update({
          rfq_data: {
            ...rfqData,
            matchedContractorIds: targets.map((contractor) => contractor.id),
            matchingAlgorithm: "verified_local_shortlist_v1",
          },
        })
        .eq("id", estimateId)
        .eq("user_id", user.id);
    }

    // 3) notifications fanout (실패해도 RFQ 등록은 성공)
    let fanoutCount = 0;
    if (targets.length > 0) {
      const rows = targets.map((c) => ({
        user_id: c.id,
        type: "rfq_published",
        title: `새 입찰 공고 — ${region.sido} ${region.gugun}`,
        message: `${body.spaceType || "주거"} ${body.exclusiveAreaM2 ?? "?"}㎡ · 예산 ₩${(body.budgetWon ?? 0).toLocaleString()} · 마감 ${body.deadlineAt.slice(0, 10)}`,
        link: `/contractor/bids?estimateId=${estimateId}`,
        is_read: false,
        metadata: {
          estimateId,
          noticeNo: body.noticeNo,
          region,
          deadlineAt: body.deadlineAt,
          matchingRank: targets.findIndex((target) => target.id === c.id) + 1,
          shortlistSize,
        },
      }));
      const { error: nErr } = await admin.from("notifications").insert(rows);
      if (!nErr) fanoutCount = rows.length;
      else console.warn("[rfq publish] notifications fanout fail:", nErr);
    }

    return NextResponse.json({
      ok: true,
      estimateId,
      fanoutCount,
      targetContractors: eligible.length,
      shortlistSize,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
