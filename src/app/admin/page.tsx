"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Users, RefreshCw,
  DollarSign, Settings, LogOut, Loader2, TrendingUp, Package
} from "lucide-react";

interface AdminState {
  isLoggedIn: boolean;
  email: string;
  name: string;
}

// Admin Login Component
function AdminLogin({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인 실패");
      } else {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_email", data.email);
        localStorage.setItem("admin_name", data.name);
        onLogin(data.email);
      }
    } catch {
      setError("서버 연결 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-600">INPICK</Link>
          <p className="text-sm text-gray-500 mt-2">관리자 로그인</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com" required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-6 h-6 ${color}`} />
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard({ admin, onLogout }: { admin: AdminState; onLogout: () => void }) {
  const [stats, setStats] = useState({
    estimates: 0, contractors: 0, materials: 0, crawlLogs: 0,
    draftEstimates: 0, activeContractors: 0,
  });
  const [recentCrawls, setRecentCrawls] = useState<{ id: string; source_name: string; status: string; records_updated: number; started_at: string }[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentCrawls(data.recentCrawls || []);
      }
    } catch { /* ignore */ }
  }

  async function runCrawler(type: string) {
    setCrawling(true);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      await loadStats();
    } catch { /* ignore */ } finally {
      setCrawling(false);
    }
  }

  const TABS = [
    { id: "overview", label: "개요", icon: BarChart3 },
    { id: "estimates", label: "견적 관리", icon: FileText },
    { id: "contractors", label: "업체 관리", icon: Users },
    { id: "prices", label: "단가 관리", icon: DollarSign },
    { id: "crawlers", label: "크롤러", icon: RefreshCw },
    { id: "settings", label: "설정", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">관리자</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{admin.name}</span>
            <button onClick={onLogout} className="text-gray-400 hover:text-gray-600" title="로그아웃">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-6 px-6 py-6">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">대시보드 개요</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={FileText} label="총 견적 수" value={`${stats.estimates}건`} color="text-blue-600" />
                <StatCard icon={Users} label="등록 업체" value={`${stats.contractors}개`} color="text-green-600" />
                <StatCard icon={Package} label="자재 단가" value={`${stats.materials}건`} color="text-purple-600" />
                <StatCard icon={TrendingUp} label="크롤 로그" value={`${stats.crawlLogs}건`} color="text-orange-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">빠른 작업</h3>
                  <div className="space-y-2">
                    <button onClick={() => runCrawler("all")} disabled={crawling}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-left disabled:opacity-50">
                      {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-blue-600" />}
                      <span className="font-medium text-gray-900">전체 단가 갱신</span>
                      <span className="text-gray-400 ml-auto">3대 기관 크롤링</span>
                    </button>
                    <Link href="/address" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-gray-900">테스트 견적 생성</span>
                    </Link>
                    <Link href="/contractor" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-gray-900">사업자 대시보드</span>
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">최근 크롤 로그</h3>
                  {recentCrawls.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">크롤 기록이 없습니다</p>
                  ) : (
                    <div className="space-y-2">
                      {recentCrawls.map((log) => (
                        <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{log.source_name}</p>
                            <p className="text-xs text-gray-400">{new Date(log.started_at).toLocaleString("ko-KR")}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              log.status === "completed" ? "bg-green-100 text-green-700" :
                              log.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                            }`}>{log.status}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{log.records_updated}건 갱신</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "estimates" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">견적 관리</h2>
              <p className="text-sm text-gray-500">전체 견적을 조회하고 관리합니다. 상세 관리는 사업자 대시보드에서 가능합니다.</p>
              <Link href="/contractor/bids" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <FileText className="w-4 h-4" /> 입찰 관리 페이지 이동
              </Link>
            </div>
          )}

          {activeTab === "contractors" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">업체 관리</h2>
              <p className="text-sm text-gray-500">등록된 전문업체를 조회하고 관리합니다.</p>
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">등록된 업체: {stats.contractors}개</p>
                <p className="text-sm text-gray-400 mt-1">업체 등록은 사업자 페이지에서 진행됩니다</p>
              </div>
            </div>
          )}

          {activeTab === "prices" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">단가 관리</h2>
              <p className="text-sm text-gray-500">자재/노임/간접비 단가를 관리합니다.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <Package className="w-8 h-8 text-blue-600 mb-2" />
                  <p className="font-semibold text-gray-900">자재 단가</p>
                  <p className="text-sm text-gray-500">한국물가협회 | 매월 갱신</p>
                  <button onClick={() => runCrawler("material")} disabled={crawling}
                    className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
                    {crawling ? "갱신 중..." : "수동 갱신"}
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <DollarSign className="w-8 h-8 text-green-600 mb-2" />
                  <p className="font-semibold text-gray-900">노임 단가</p>
                  <p className="text-sm text-gray-500">대한건설협회 | 반기별 갱신</p>
                  <button onClick={() => runCrawler("labor")} disabled={crawling}
                    className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
                    {crawling ? "갱신 중..." : "수동 갱신"}
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                  <p className="font-semibold text-gray-900">간접비율</p>
                  <p className="text-sm text-gray-500">조달청 | 연간 갱신</p>
                  <button onClick={() => runCrawler("overhead")} disabled={crawling}
                    className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
                    {crawling ? "갱신 중..." : "수동 갱신"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "crawlers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">크롤러 관리</h2>
                <button onClick={() => runCrawler("all")} disabled={crawling}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  전체 크롤링 실행
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">소스</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">갱신 건수</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">실행 시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentCrawls.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">크롤 기록이 없습니다</td></tr>
                    ) : recentCrawls.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{log.source_name}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            log.status === "completed" ? "bg-green-100 text-green-700" :
                            log.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                          }`}>{log.status}</span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500 text-right">{log.records_updated}건</td>
                        <td className="px-6 py-3 text-sm text-gray-400 text-right">{new Date(log.started_at).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">설정</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">플랫폼 정보</p>
                  <p className="text-sm text-gray-500">회사명: AIOD | 플랫폼: INPICK</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">관리자 계정</p>
                  <p className="text-sm text-gray-500">{admin.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">환경 변수 상태</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">SUPABASE: <span className="text-green-600">연결됨</span></p>
                    <p className="text-xs text-gray-500">JUSO API: <span className="text-green-600">설정됨</span></p>
                    <p className="text-xs text-gray-500">ANTHROPIC API: <span className="text-yellow-600">크레딧 충전 필요</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminState>({ isLoggedIn: false, email: "", name: "" });

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const email = localStorage.getItem("admin_email");
    const name = localStorage.getItem("admin_name");
    if (token && email) {
      setAdmin({ isLoggedIn: true, email, name: name || "Admin" });
    }
  }, []);

  const handleLogin = (email: string) => {
    const name = localStorage.getItem("admin_name") || "Admin";
    setAdmin({ isLoggedIn: true, email, name });
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    setAdmin({ isLoggedIn: false, email: "", name: "" });
  };

  if (!admin.isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard admin={admin} onLogout={handleLogout} />;
}
