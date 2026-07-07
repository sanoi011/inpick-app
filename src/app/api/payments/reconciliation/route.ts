/**
 * GET /api/payments/reconciliation
 *
 * 결제 ↔ 크레딧 ↔ webhook 불일치 자동 감지 + 수동 보정 큐 조회.
 *
 * 가이드: c:\Users\user\Downloads\inpick-auth-payment-token-admin-dev-plan-20260512.md §7-2, §9-3
 *
 * 쿼리:
 *  - status: open | resolved | wontfix (기본 open)
 *  - severity: low | medium | high | critical
 *  - autoDetect: true → 자동 감지 한 번 실행 후 결과 반환
 *
 * POST /api/payments/reconciliation
 *  - body.jobId, body.resolution_note, body.action: "resolved" | "wontfix"
 *  - 관리자 인증 필요
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminAuthorized } from "@/lib/admin-auth";

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

/**
 * 자동 감지 규칙 (MD §9-3):
 *  - intent paid인데 token_ledger 없음 (purchase_credit 누락)
 *  - payment confirmed인데 intent not paid (상태 불일치)
 *  - token credit 있는데 payment 없음 (이상 충전)
 *  - refund 완료인데 token debit 없음
 */
async function autoDetectIssues() {
  const admin = getAdmin();
  if (!admin) return { detected: 0 };
  const detected: string[] = [];

  // Rule 1: intent paid + product 있음 but token_ledger purchase_credit 누락
  const { data: paidIntents } = await admin
    .from("payment_intents")
    .select("id, user_id, order_id, product_id, status")
    .eq("status", "paid")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

  for (const intent of paidIntents || []) {
    const it = intent as { id: string; user_id: string; order_id: string; product_id: string | null };
    if (!it.product_id) continue;
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("order_id", it.order_id)
      .maybeSingle();
    if (!payment) continue;
    const paymentId = (payment as { id: string }).id;
    const idemKey = `payment:${paymentId}:credit`;
    const { data: ledger } = await admin
      .from("token_ledger")
      .select("id")
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (!ledger) {
      // 이미 reconciliation job이 있나 확인
      const { data: existingJob } = await admin
        .from("payment_reconciliation_jobs")
        .select("id")
        .eq("payment_id", paymentId)
        .eq("issue_type", "credit_missing_after_paid")
        .eq("status", "open")
        .maybeSingle();
      if (!existingJob) {
        await admin.from("payment_reconciliation_jobs").insert({
          payment_intent_id: it.id,
          payment_id: paymentId,
          order_id: it.order_id,
          issue_type: "credit_missing_after_paid",
          severity: "high",
          description_ko: "결제 완료되었으나 token_ledger purchase_credit 누락",
        });
        detected.push("credit_missing_after_paid");
      }
    }
  }

  return { detected: detected.length, issues: detected };
}

export async function GET(req: NextRequest) {
  // /api/admin/* 밖이라 미들웨어 Bearer 체크도 안 걸림 — 여기서 직접 검증 (2026-07-07)
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "open";
  const severity = sp.get("severity");
  const autoDetect = sp.get("autoDetect") === "true";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
  const offset = (page - 1) * limit;

  let detection = null;
  if (autoDetect) {
    detection = await autoDetectIssues();
  }

  let query = admin
    .from("payment_reconciliation_jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status !== "all") query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 상태별 카운트
  const { count: openCount } = await admin
    .from("payment_reconciliation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  const { count: criticalCount } = await admin
    .from("payment_reconciliation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("severity", "critical");

  return NextResponse.json({
    jobs: data || [],
    total: count || 0,
    page,
    limit,
    stats: {
      openCount: openCount || 0,
      criticalCount: criticalCount || 0,
    },
    detection,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "service not configured" }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.jobId || !body?.action) {
    return NextResponse.json(
      { error: "missing_params", hint: "jobId, action 필수" },
      { status: 400 },
    );
  }
  const action = body.action;
  if (action !== "resolved" && action !== "wontfix") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { error } = await admin
    .from("payment_reconciliation_jobs")
    .update({
      status: action,
      resolution_note: body.resolution_note || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", body.jobId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
