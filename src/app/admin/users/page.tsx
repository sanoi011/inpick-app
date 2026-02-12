"use client";

import { useState, useEffect } from "react";
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface ConsumerUser {
  id: string;
  balance: number;
  freeGenerationsUsed: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ContractorUser {
  id: string;
  company_name: string;
  email: string;
  phone: string;
  region: string;
  rating: number;
  review_count: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { authChecked } = useAdminAuth();
  const [tab, setTab] = useState<"consumer" | "contractor">("consumer");
  const [consumers, setConsumers] = useState<ConsumerUser[]>([]);
  const [contractors, setContractors] = useState<ContractorUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, tab, page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      const data = await res.json();
      if (tab === "consumer") setConsumers(data.users || []);
      else setContractors(data.users || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">사용자 관리</h2>
        <p className="text-sm text-gray-500">총 {total}명</p>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => { setTab("consumer"); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "consumer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            소비자
          </button>
          <button onClick={() => { setTab("contractor"); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "contractor" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            사업자
          </button>
        </div>
        {tab === "contractor" && (
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="회사명 또는 이메일" className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-60" />
            </div>
            <button type="submit" className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg">검색</button>
          </form>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : tab === "consumer" ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">사용자 ID</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">크레딧 잔액</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">무료 사용</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">프로젝트</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consumers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />등록된 소비자가 없습니다
                </td></tr>
              ) : consumers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{u.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{u.balance}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">{u.freeGenerationsUsed}/1</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">{u.projectCount}건</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">회사명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">지역</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">평점</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contractors.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />등록된 업체가 없습니다
                </td></tr>
              ) : contractors.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.company_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.region || "-"}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500">{c.rating?.toFixed(1) || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">{new Date(c.created_at).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
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
