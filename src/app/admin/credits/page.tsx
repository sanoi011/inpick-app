"use client";

import { useState, useEffect } from "react";
import { DollarSign, Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface CreditUser {
  id: string;
  user_id: string;
  balance: number;
  free_generations_used: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface Summary {
  totalBalance: number;
  totalFreeUsed: number;
  userCount: number;
  txByType: Record<string, number>;
}

const TX_TYPES = [
  { value: "", label: "전체" },
  { value: "CHARGE", label: "충전" },
  { value: "USE", label: "사용" },
  { value: "FREE", label: "무료" },
  { value: "REFUND", label: "환불" },
];

export default function AdminCreditsPage() {
  const { authChecked } = useAdminAuth();
  const [tab, setTab] = useState<"users" | "transactions">("users");
  const [credits, setCredits] = useState<CreditUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);

  // 수동 충전 폼
  const [showGrant, setShowGrant] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, tab, page, typeFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: tab, page: String(page), limit: "20" });
      if (tab === "transactions" && typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/credits?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      if (tab === "users") {
        setCredits(data.credits || []);
        setSummary(data.summary || null);
      } else {
        setTransactions(data.transactions || []);
      }
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleGrant() {
    if (!grantUserId || !grantAmount) return;
    setGranting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({
          userId: grantUserId,
          amount: parseInt(grantAmount),
          type: "CHARGE",
          description: grantDesc || `관리자 수동 부여 (+${grantAmount})`,
        }),
      });
      if (res.ok) {
        setShowGrant(false);
        setGrantUserId("");
        setGrantAmount("");
        setGrantDesc("");
        load();
      }
    } catch { /* ignore */ }
    setGranting(false);
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">크레딧 관리</h2>
        <button onClick={() => setShowGrant(!showGrant)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">
          <Plus className="w-4 h-4" /> 수동 부여
        </button>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">사용자 수</p>
            <p className="text-xl font-bold text-gray-900">{summary.userCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">총 잔액</p>
            <p className="text-xl font-bold text-blue-600">{summary.totalBalance}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">총 충전</p>
            <p className="text-xl font-bold text-green-600">{summary.txByType?.CHARGE || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">총 사용</p>
            <p className="text-xl font-bold text-orange-600">{Math.abs(summary.txByType?.USE || 0)}</p>
          </div>
        </div>
      )}

      {/* 수동 부여 폼 */}
      {showGrant && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">크레딧 수동 부여</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="사용자 UUID"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="크레딧 수량" type="number"
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input value={grantDesc} onChange={(e) => setGrantDesc(e.target.value)} placeholder="설명 (선택)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button onClick={handleGrant} disabled={granting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : "부여"}
            </button>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setTab("users"); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "users" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            사용자별
          </button>
          <button onClick={() => { setTab("transactions"); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "transactions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            거래 내역
          </button>
        </div>
        {tab === "transactions" && (
          <div className="flex flex-wrap gap-2">
            {TX_TYPES.map((t) => (
              <button key={t.value} onClick={() => { setTypeFilter(t.value); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${typeFilter === t.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : tab === "users" ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자 ID</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">잔액</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">무료 사용</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">마지막 업데이트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {credits.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />데이터가 없습니다
                </td></tr>
              ) : credits.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{c.user_id?.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{c.balance}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">{c.free_generations_used}/1</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(c.updated_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">수량</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">타입</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">설명</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">거래 내역이 없습니다</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{tx.user_id?.slice(0, 8)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.type === "CHARGE" ? "bg-green-100 text-green-700" :
                      tx.type === "USE" ? "bg-orange-100 text-orange-700" :
                      tx.type === "FREE" ? "bg-blue-100 text-blue-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>{tx.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{tx.description || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(tx.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
