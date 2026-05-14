/**
 * GET  /api/community/posts/[postId]/quote-offers
 * POST /api/community/posts/[postId]/quote-offers
 *
 * 검증 사업자만 견적 제안 작성 가능.
 * 가이드: §8-5
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { mapDbQuoteOffer } from "@/types/community-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("community_quote_offers")
    .select("*")
    .eq("post_id", params.postId)
    .neq("offer_status", "hidden_by_admin")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[community/quote-offers] GET error:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({
    offers: (data ?? []).map((r) => mapDbQuoteOffer(r as Record<string, unknown>)),
  });
}

export async function POST(req: NextRequest, { params }: { params: { postId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // 검증 사업자 여부 확인 (community_profiles)
  const { data: profile } = await supabase
    .from("community_profiles")
    .select("is_verified_contractor")
    .eq("user_id", user.id)
    .maybeSingle();
  const isVerified = !!(profile as { is_verified_contractor: boolean } | null)?.is_verified_contractor;

  // 관리자 설정 확인
  const admin = getAdmin();
  let requireApproval = true;
  if (admin) {
    const { data: setting } = await admin
      .from("community_admin_settings")
      .select("value")
      .eq("key", "contractorOfferApprovalRequired")
      .maybeSingle();
    if (setting) {
      const val = (setting as { value: unknown }).value;
      requireApproval = val === true || val === "true";
    }
  }

  if (!isVerified) {
    return NextResponse.json(
      { error: "verification_required", hint: "검증 사업자만 견적 제안 작성 가능" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    offerType?: string;
    amountMin?: number;
    amountMax?: number;
    amountFixed?: number;
    message?: string;
    assumptions?: string[];
    exclusions?: string[];
    suggestedScope?: Record<string, unknown>;
  };
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }

  // 금액 검증
  for (const [k, v] of [
    ["amountMin", body.amountMin],
    ["amountMax", body.amountMax],
    ["amountFixed", body.amountFixed],
  ] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return NextResponse.json({ error: `invalid_${k}` }, { status: 400 });
    }
  }
  if (body.amountMin != null && body.amountMax != null && body.amountMin > body.amountMax) {
    return NextResponse.json({ error: "invalid_amount_range" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("community_quote_offers")
    .insert({
      post_id: params.postId,
      contractor_user_id: user.id,
      offer_status: "submitted",
      offer_type: body.offerType ?? "rough_opinion",
      amount_min: body.amountMin ?? null,
      amount_max: body.amountMax ?? null,
      amount_fixed: body.amountFixed ?? null,
      message: body.message.trim(),
      suggested_scope: body.suggestedScope ?? {},
      assumptions: body.assumptions ?? [],
      exclusions: body.exclusions ?? [],
      admin_review_status: requireApproval ? "pending" : "not_required",
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[community/quote-offers] POST error:", error?.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 게시글 카운터 증가
  if (admin) {
    const { data: post } = await admin
      .from("community_posts")
      .select("quote_offer_count")
      .eq("id", params.postId)
      .maybeSingle();
    if (post) {
      await admin
        .from("community_posts")
        .update({
          quote_offer_count: (post as { quote_offer_count: number }).quote_offer_count + 1,
        })
        .eq("id", params.postId);
    }
  }

  return NextResponse.json({
    offerId: (inserted as { id: string }).id,
    requireApproval,
  });
}
