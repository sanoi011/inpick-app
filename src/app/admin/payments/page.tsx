"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface PaymentIntentRow {
  id: string;
  user_id: string;
  order_id: string;
  order_name: string;
  amount_krw: number;
  product_type: string;
  status: string;
  provider: string;
  customer_key: string;
  created_at: string;
  product: Array<{ code: string; name_ko: string; credit_amount: number; bonus_credit_amount: number }> | { code: string; name_ko: string; credit_amount: number; bonus_credit_amount: number } | null;
  payment: Array<{ id: string; payment_key: string; method: string; status: string; approved_at: string }> | null;
}

interface PaymentsResp {
  items: PaymentIntentRow[];
  total: number;
  page: number;
  limit: number;
  stats: {
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    totalRevenueWon: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  created: { label: "대기", color: "bg-gray-100 text-gray-600", icon: Clock },
  confirming: { label: "확인 중", color: "bg-blue-50 text-blue-700", icon: Loader2 },
  paid: { label: "완료", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  provisioned: { label: "지급 완료", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  confirm_failed: { label: "확인 실패", color: "bg-red-50 text-red-700", icon: XCircle },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500", icon: XCircle },
  refunded: { label: "환불", color: "bg-amber-50 text-amber-700", icon: RotateCcw },
  partial_refunded: { label: "부분환불", color: "bg-amber-50 text-amber-700", icon: RotateCcw },
  expired: { label: "만료", color: "bg-gray-100 text-gray-400", icon: Clock },
  needs_manual_review: { label: "수동 검토", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export default function AdminPaymentsPage() {
  const { authChecked } = useAdminAuth();
  const [data, setData] = useState<PaymentsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/payments?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">결제 관리</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            payment_intents + payments + payment_events 통합 모니터링
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
        >
          <RefreshCcw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="누적 매출" value={`₩${data.stats.totalRevenueWon.toLocaleString()}`} color="emerald" />
          <StatCard label="완료" value={data.stats.paidCount.toLocaleString()} color="emerald" />
          <StatCard label="대기/진행" value={data.stats.pendingCount.toLocaleString()} color="blue" />
          <StatCard label="실패/수동검토" value={data.stats.failedCount.toLocaleString()} color="red" />
          <StatCard label="환불" value={data.stats.refundedCount.toLocaleString()} color="amber" />
        </div>
      )}

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => { setStatus(""); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-semibold ${status === "" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
        >
          전체
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => { setStatus(k); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${status === k ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            결제 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">orderId</th>
                  <th className="text-left px-3 py-2">user</th>
                  <th className="text-left px-3 py-2">상품</th>
                  <th className="text-right px-3 py-2">금액</th>
                  <th className="text-right px-3 py-2">크레딧</th>
                  <th className="text-left px-3 py-2">결제수단</th>
                  <th className="text-center px-3 py-2">상태</th>
                  <th className="text-right px-3 py-2">생성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => {
                  const meta = STATUS_LABELS[row.status] || STATUS_LABELS.created;
                  const Icon = meta.icon;
                  const product = Array.isArray(row.product) ? row.product[0] : row.product;
                  const payment = row.payment?.[0];
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]" title={row.order_id}>
                        {row.order_id}
                      </td>
                      <td className="px-3 py-2 text-gray-500 font-mono">
                        {row.user_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {product?.name_ko || row.order_name}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        ₩{row.amount_krw.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-600">
                        {product ? `${product.credit_amount}+${product.bonus_credit_amount}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {payment?.method || "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">
                        {new Date(row.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${colors[color] || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
