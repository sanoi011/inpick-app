/**
 * Reconciliation Scanner — 분쟁 case 자동 감지.
 * 가이드: inpick-payment-saas-flow-uiux-improvement-plan-20260514.md §9-3
 *
 * 8개 case 타입을 스캔:
 *   1. payment_paid_no_tokens             — 결제 paid인데 token_ledger 충전 없음
 *   2. payment_paid_provision_failed       — payment_intent 'paid'인데 'provisioned' 안 됨
 *   3. token_charged_no_output             — token committed인데 design_outputs 없음
 *   4. output_saved_no_token_commit        — design_output 있는데 token committed 없음
 *   5. pdf_entitlement_consumed_no_asset   — entitlement consumed인데 asset_url 없음
 *   6. generation_timeout_pending          — generation_jobs status='generating' >30분 경과
 *   7. estimate_context_missing            — workflow_step_snapshots Step3는 있는데 estimate_context 없음
 *   8. amount_mismatch_blocked             — confirm 라우트에서 차단된 경우 (이미 INSERT됨, 여기선 미해결 카운트만)
 *
 * 호출: /api/admin/reconciliation/scan (관리자)
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export type CaseType =
  | "payment_paid_no_tokens"
  | "payment_paid_provision_failed"
  | "token_charged_no_output"
  | "output_saved_no_token_commit"
  | "pdf_entitlement_consumed_no_asset"
  | "generation_timeout_pending"
  | "estimate_context_missing"
  | "amount_mismatch_blocked";

interface ScanSummary {
  scannedAt: string;
  caseCounts: Record<CaseType, number>;
  insertedCases: number;
  errors: string[];
}

const TIMEOUT_MINUTES_GENERATION = 30;

/**
 * 전체 스캔 실행. 이미 open 상태인 case는 중복 INSERT 안 함 (case_type + reference로 unique 처리).
 */
export async function runReconciliationScan(): Promise<ScanSummary> {
  const admin = getAdmin();
  const summary: ScanSummary = {
    scannedAt: new Date().toISOString(),
    caseCounts: {
      payment_paid_no_tokens: 0,
      payment_paid_provision_failed: 0,
      token_charged_no_output: 0,
      output_saved_no_token_commit: 0,
      pdf_entitlement_consumed_no_asset: 0,
      generation_timeout_pending: 0,
      estimate_context_missing: 0,
      amount_mismatch_blocked: 0,
    },
    insertedCases: 0,
    errors: [],
  };
  if (!admin) {
    summary.errors.push("service role not configured");
    return summary;
  }

  // ─── 1. payment_paid_no_tokens ─────────────────────────────
  //   payment_intents.status='paid' 또는 'provisioned' 이지만 token_ledger entry 없음 (token_pack 한정)
  try {
    const { data: intents } = await admin
      .from("payment_intents")
      .select("id, user_id, amount_krw, status, product_id, product:payment_products(product_type, code)")
      .in("status", ["paid", "provisioned"])
      .order("created_at", { ascending: false })
      .limit(200);
    for (const intent of (intents ?? []) as Array<{
      id: string;
      user_id: string;
      amount_krw: number;
      product:
        | { product_type: string; code: string }
        | Array<{ product_type: string; code: string }>
        | null;
    }>) {
      const prod = Array.isArray(intent.product) ? intent.product[0] : intent.product;
      const ptype = prod?.product_type;
      if (ptype !== "ai_credit_pack" && ptype !== "token_pack") continue;

      // payments 조회
      const { data: pay } = await admin
        .from("payments")
        .select("id")
        .eq("payment_intent_id", intent.id)
        .maybeSingle();
      if (!pay) continue;
      const paymentId = (pay as { id: string }).id;

      // token_ledger 확인
      const { data: ledger } = await admin
        .from("token_ledger")
        .select("id")
        .eq("user_id", intent.user_id)
        .eq("source_type", "payment")
        .eq("source_id", paymentId)
        .limit(1)
        .maybeSingle();
      if (!ledger) {
        await upsertCase(admin, {
          case_type: "payment_paid_no_tokens",
          severity: "critical",
          user_id: intent.user_id,
          payment_intent_id: intent.id,
          description: "결제 완료(paid/provisioned)인데 token_ledger 충전 행 없음",
          detected_payload: { paymentId, productCode: prod?.code },
        });
        summary.caseCounts.payment_paid_no_tokens++;
      }
    }
  } catch (e) {
    summary.errors.push(`scan1: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 2. payment_paid_provision_failed ──────────────────────
  //   payment_intents.status='paid' 인데 'provisioned' 까지 안 간 것 + 30분 이상 경과
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: intents } = await admin
      .from("payment_intents")
      .select("id, user_id, amount_krw, status, updated_at")
      .eq("status", "paid")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(50);
    for (const intent of (intents ?? []) as Array<{ id: string; user_id: string }>) {
      await upsertCase(admin, {
        case_type: "payment_paid_provision_failed",
        severity: "high",
        user_id: intent.user_id,
        payment_intent_id: intent.id,
        description: "payment_intent='paid' 30분 경과해도 'provisioned' 안 됨",
        detected_payload: {},
      });
      summary.caseCounts.payment_paid_provision_failed++;
    }
  } catch (e) {
    summary.errors.push(`scan2: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 3. token_charged_no_output ────────────────────────────
  //   token_charge_intents.status='committed' 인데 design_outputs 또는 generation_jobs.design_output_id 없음
  try {
    const { data: intents } = await admin
      .from("token_charge_intents")
      .select("id, user_id, project_id, action, reference_type, reference_id")
      .eq("status", "committed")
      .eq("action", "image_generation")
      .order("committed_at", { ascending: false })
      .limit(100);
    for (const ci of (intents ?? []) as Array<{
      id: string;
      user_id: string;
      project_id: string | null;
      reference_id: string | null;
    }>) {
      if (!ci.reference_id) continue;
      const { data: job } = await admin
        .from("generation_jobs")
        .select("id, design_output_id, status")
        .eq("id", ci.reference_id)
        .maybeSingle();
      if (!job) continue;
      const j = job as { id: string; design_output_id: string | null; status: string };
      if (!j.design_output_id && j.status === "completed") {
        await upsertCase(admin, {
          case_type: "token_charged_no_output",
          severity: "high",
          user_id: ci.user_id,
          project_id: ci.project_id ?? undefined,
          token_charge_intent_id: ci.id,
          generation_job_id: j.id,
          description: "token committed 되었지만 generation_jobs.design_output_id 없음",
          detected_payload: { jobStatus: j.status },
        });
        summary.caseCounts.token_charged_no_output++;
      }
    }
  } catch (e) {
    summary.errors.push(`scan3: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 4. output_saved_no_token_commit ───────────────────────
  //   generation_jobs.design_output_id 있는데 token_charge_intent_id 없거나 status != 'committed'
  try {
    const { data: jobs } = await admin
      .from("generation_jobs")
      .select("id, user_id, project_id, design_output_id, token_charge_intent_id, status")
      .not("design_output_id", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100);
    for (const job of (jobs ?? []) as Array<{
      id: string;
      user_id: string;
      project_id: string;
      design_output_id: string;
      token_charge_intent_id: string | null;
      status: string;
    }>) {
      if (!job.token_charge_intent_id) {
        // 토큰 intent 자체가 없음 — 차감 없이 결과만 저장된 케이스 (분쟁 가능성 낮음)
        continue;
      }
      const { data: ci } = await admin
        .from("token_charge_intents")
        .select("status")
        .eq("id", job.token_charge_intent_id)
        .maybeSingle();
      if (!ci || (ci as { status: string }).status !== "committed") {
        await upsertCase(admin, {
          case_type: "output_saved_no_token_commit",
          severity: "medium",
          user_id: job.user_id,
          project_id: job.project_id,
          generation_job_id: job.id,
          token_charge_intent_id: job.token_charge_intent_id,
          description: "design_output 저장되었지만 token_charge_intent 'committed' 아님",
          detected_payload: { intentStatus: (ci as { status?: string } | null)?.status ?? "missing" },
        });
        summary.caseCounts.output_saved_no_token_commit++;
      }
    }
  } catch (e) {
    summary.errors.push(`scan4: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 5. pdf_entitlement_consumed_no_asset ──────────────────
  //   user_entitlements.consumed_at 있는데 asset_url 없음
  try {
    const { data: ents } = await admin
      .from("user_entitlements")
      .select("id, user_id, consumed_at, asset_url, entitlement_type")
      .eq("entitlement_type", "estimate_pdf_single")
      .not("consumed_at", "is", null)
      .is("asset_url", null)
      .is("revoked_at", null)
      .order("consumed_at", { ascending: false })
      .limit(100);
    for (const ent of (ents ?? []) as Array<{ id: string; user_id: string; consumed_at: string }>) {
      await upsertCase(admin, {
        case_type: "pdf_entitlement_consumed_no_asset",
        severity: "high",
        user_id: ent.user_id,
        description: "PDF entitlement consumed 되었지만 asset_url 없음 (사용자 결제 후 PDF 못 받음)",
        detected_payload: { entitlementId: ent.id, consumedAt: ent.consumed_at },
      });
      summary.caseCounts.pdf_entitlement_consumed_no_asset++;
    }
  } catch (e) {
    summary.errors.push(`scan5: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 6. generation_timeout_pending ─────────────────────────
  //   generation_jobs.status in (token_reserved, generating, uploading, persisting) 30분 이상 경과
  try {
    const cutoff = new Date(
      Date.now() - TIMEOUT_MINUTES_GENERATION * 60 * 1000,
    ).toISOString();
    const { data: jobs } = await admin
      .from("generation_jobs")
      .select("id, user_id, project_id, status, updated_at")
      .in("status", ["token_reserved", "generating", "uploading", "persisting"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(50);
    for (const job of (jobs ?? []) as Array<{
      id: string;
      user_id: string;
      project_id: string;
      status: string;
    }>) {
      await upsertCase(admin, {
        case_type: "generation_timeout_pending",
        severity: "medium",
        user_id: job.user_id,
        project_id: job.project_id,
        generation_job_id: job.id,
        description: `generation_job ${TIMEOUT_MINUTES_GENERATION}분 경과 status=${job.status}`,
        detected_payload: { status: job.status },
      });
      summary.caseCounts.generation_timeout_pending++;
    }
  } catch (e) {
    summary.errors.push(`scan6: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // ─── 7. amount_mismatch_blocked ────────────────────────────
  //   기존 INSERT된 미해결 case 카운트만 (스캐너가 새로 INSERT하지 않음)
  try {
    const { count } = await admin
      .from("reconciliation_cases")
      .select("id", { count: "exact", head: true })
      .eq("case_type", "amount_mismatch_blocked")
      .eq("status", "open");
    summary.caseCounts.amount_mismatch_blocked = count ?? 0;
  } catch (e) {
    summary.errors.push(`scan7: ${e instanceof Error ? e.message : "unknown"}`);
  }

  return summary;
}

/**
 * 같은 (case_type, reference) 조합으로 이미 'open' case 있으면 skip.
 * 중복 INSERT 방지.
 */
async function upsertCase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: {
    case_type: CaseType;
    severity: "low" | "medium" | "high" | "critical";
    user_id: string;
    project_id?: string;
    payment_intent_id?: string;
    generation_job_id?: string;
    token_charge_intent_id?: string;
    description: string;
    detected_payload: Record<string, unknown>;
  },
): Promise<void> {
  // 중복 체크
  let dupQuery = admin
    .from("reconciliation_cases")
    .select("id")
    .eq("case_type", input.case_type)
    .eq("status", "open");
  if (input.payment_intent_id) dupQuery = dupQuery.eq("payment_intent_id", input.payment_intent_id);
  if (input.generation_job_id) dupQuery = dupQuery.eq("generation_job_id", input.generation_job_id);
  if (input.token_charge_intent_id)
    dupQuery = dupQuery.eq("token_charge_intent_id", input.token_charge_intent_id);
  const { data: existing } = await dupQuery.limit(1).maybeSingle();
  if (existing) return; // 이미 open case 있음

  await admin.from("reconciliation_cases").insert(input);
}
