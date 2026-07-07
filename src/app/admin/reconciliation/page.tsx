"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCcw,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface ReconciliationJob {
  id: string;
  payment_intent_id?: string;
  payment_id?: string;
  order_id?: string;
  payment_key?: string;
  issue_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "wontfix";
  description_ko: string;
  resolution_note?: string;
  created_at: string;
  resolved_at?: string;
}

interface ReconciliationResp {
  jobs: ReconciliationJob[];
  total: number;
  stats: { openCount: number; criticalCount: number };
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export default function AdminReconciliationPage() {
  const { authChecked } = useAdminAuth();
  const [data, setData] = useState<ReconciliationResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "wontfix" | "all">("open");
  const [detecting, setDetecting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const load = useCallback(async (autoDetect = false) => {
    setLoading(true);
    if (autoDetect) setDetecting(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "50" });
      if (autoDetect) params.set("autoDetect", "true");
      const res = await fetch(`/api/payments/reconciliation?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setDetecting(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  const handleResolve = async (jobId: string, action: "resolved" | "wontfix") => {
    setResolvingId(jobId);
    try {
      const res = await fetch("/api/payments/reconciliation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({ jobId, action, resolution_note: resolutionNote }),
      });
      if (res.ok) {
        setResolutionNote("");
        await load();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingId(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">결제 보정 큐 (Reconciliation)</h2>
          <p className="text-xs text-gray-500 mt-0.5">결제 ↔ 크레딧 ↔ webhook 불일치 자동 감지</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            disabled={detecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            자동 감지 실행
          </button>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
          >
            <RefreshCcw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">처리 대기</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{data.stats.openCount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">긴급 (critical)</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{data.stats.criticalCount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* 신규: reconciliation_cases 워크플로우 분쟁 (pricing-saas-flow §9-3) */}
      <ReconciliationCasesSection />


      <div className="flex gap-1.5">
        {(["open", "resolved", "wontfix", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              statusFilter === s ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            {s === "open" ? "처리 대기" : s === "resolved" ? "해결됨" : s === "wontfix" ? "무시" : "전체"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
            처리할 보정 작업이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_COLORS[job.severity]}`}>
                        {job.severity}
                      </span>
                      <span className="text-xs font-mono text-gray-500">{job.issue_type}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(job.created_at).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{job.description_ko}</p>
                    {job.order_id && (
                      <p className="mt-1 text-[10px] font-mono text-gray-400">
                        order: {job.order_id}
                        {job.payment_key && ` / pay: ${job.payment_key.slice(0, 12)}...`}
                      </p>
                    )}
                    {job.resolution_note && (
                      <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                        해결: {job.resolution_note}
                      </p>
                    )}
                  </div>
                  {job.status === "open" && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleResolve(job.id, "resolved")}
                        disabled={resolvingId === job.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-white text-xs rounded hover:bg-emerald-600 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        해결
                      </button>
                      <button
                        onClick={() => handleResolve(job.id, "wontfix")}
                        disabled={resolvingId === job.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        무시
                      </button>
                    </div>
                  )}
                </div>
                {job.status === "open" && resolvingId !== job.id && (
                  <input
                    type="text"
                    placeholder="해결 메모 (선택)"
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="mt-2 w-full text-xs px-2 py-1 border border-gray-200 rounded"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">자동 감지 규칙</p>
            <ul className="space-y-0.5 ml-3 list-disc">
              <li><b>credit_missing_after_paid</b>: 결제 완료되었으나 token_ledger 누락</li>
              <li><b>amount_mismatch</b>: 클라이언트 금액 ≠ 서버 금액 (위조 시도 의심)</li>
              <li><b>toss_amount_mismatch</b>: Toss 응답 금액 ≠ 서버 금액</li>
              <li><b>webhook_credit_failed</b>: webhook 보정 실패</li>
              <li><b>partial_cancel_received</b>: 부분 취소 webhook (수동 확인 필요)</li>
              <li><b>refund_debit_failed</b>: 환불 시 크레딧 차감 실패</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 신규 reconciliation_cases 섹션 (pricing-saas-flow §9-3) ─────────
interface CaseRow {
  id: string;
  case_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "dismissed";
  user_id: string | null;
  project_id: string | null;
  payment_intent_id: string | null;
  generation_job_id: string | null;
  token_charge_intent_id: string | null;
  description: string;
  detected_payload: Record<string, unknown>;
  created_at: string;
}

const CASE_TYPE_LABELS: Record<string, string> = {
  payment_paid_no_tokens: "결제 완료 / 토큰 미지급",
  payment_paid_provision_failed: "결제 완료 / provisioning 실패",
  token_charged_no_output: "토큰 차감 / 결과물 없음",
  output_saved_no_token_commit: "결과물 있음 / 토큰 commit 없음",
  pdf_entitlement_consumed_no_asset: "PDF 권한 소비 / asset 없음",
  generation_timeout_pending: "이미지 생성 timeout",
  estimate_context_missing: "견적 context 누락",
  amount_mismatch_blocked: "amount 위조 차단",
};

function ReconciliationCasesSection() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const auth = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : ""}`,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reconciliation/cases?status=open&limit=100", { headers: auth() });
    if (res.ok) {
      const d = await res.json();
      setCases(d.cases ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const runScan = async () => {
    setScanning(true);
    const res = await fetch("/api/admin/reconciliation/scan", { method: "POST", headers: auth() });
    if (res.ok) {
      const d = await res.json();
      setCounts(d.caseCounts ?? null);
      await reload();
    }
    setScanning(false);
  };

  const handleAction = async (caseId: string, action: "resolve" | "dismiss") => {
    const res = await fetch("/api/admin/reconciliation/cases", {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ caseId, action }),
    });
    if (res.ok) reload();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">워크플로우 분쟁 case (v2 reconciliation_cases)</h3>
          <p className="text-xs text-gray-500 mt-0.5">결제·토큰·이미지·PDF 통합 분쟁 감지</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          전수 스캔 실행
        </button>
      </div>

      {/* 8개 case 카운트 카드 */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {Object.entries(counts).map(([ct, n]) => (
            <div key={ct} className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs">
              <p className="text-gray-500 truncate">{CASE_TYPE_LABELS[ct] ?? ct}</p>
              <p className={`mt-0.5 text-base font-bold ${n > 0 ? "text-amber-700" : "text-gray-400"}`}>{n}</p>
            </div>
          ))}
        </div>
      )}

      {/* open case 리스트 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-4 text-center text-sm text-emerald-700">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
          처리 대기 case 없음
        </div>
      ) : (
        <div className="space-y-1.5">
          {cases.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${SEVERITY_COLORS[c.severity]}`}
                    >
                      {c.severity}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      {CASE_TYPE_LABELS[c.case_type] ?? c.case_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{c.description}</p>
                  <p className="text-[0.65rem] text-gray-400 mt-0.5">
                    user {c.user_id?.slice(0, 8) ?? "-"} ·{" "}
                    {new Date(c.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAction(c.id, "resolve")}
                    className="rounded bg-emerald-600 px-2 py-1 text-[0.65rem] font-semibold text-white"
                  >
                    해결
                  </button>
                  <button
                    onClick={() => handleAction(c.id, "dismiss")}
                    className="rounded bg-gray-300 px-2 py-1 text-[0.65rem] text-gray-700"
                  >
                    무시
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
