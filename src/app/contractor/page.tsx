"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, FileText, Users, Bot, Calendar, Loader2, Plus } from "lucide-react";

const MENU_ITEMS = [
  { label: "입찰 관리", href: "/contractor/bids", icon: FileText, description: "새 입찰 참여 및 관리" },
  { label: "AI 비서", href: "/contractor/ai", icon: Bot, description: "AI 기반 분석 및 알림" },
  { label: "전문업체 매칭", href: "#", icon: Users, description: "공종별 전문업체 협업" },
  { label: "일정 관리", href: "#", icon: Calendar, description: "프로젝트 일정 및 스케줄" },
];

interface DashboardStats {
  activeProjects: number;
  pendingBids: number;
  completedProjects: number;
  avgRating: string;
}

export default function ContractorDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingBids: 0,
    completedProjects: 0,
    avgRating: "-",
  });
  const [recentEstimates, setRecentEstimates] = useState<{ id: string; title: string; status: string; grand_total: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch("/api/estimates");
        const data = await res.json();
        const estimates = data.estimates || [];

        setRecentEstimates(estimates.slice(0, 5));
        setStats({
          activeProjects: estimates.filter((e: { status: string }) => e.status === "in_progress").length,
          pendingBids: estimates.filter((e: { status: string }) => e.status === "draft").length,
          completedProjects: estimates.filter((e: { status: string }) => e.status === "completed").length,
          avgRating: "-",
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">사업자 대시보드</span>
          </div>
          <Link href="/auth" className="text-sm text-gray-500 hover:text-gray-700">로그인</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">대시보드</h1>
            <p className="text-gray-500">프로젝트와 입찰을 한눈에 관리하세요</p>
          </div>
          <Link
            href="/address"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 견적
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  <span className="text-xs text-gray-400">이번 달</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}건</p>
                <p className="text-sm text-gray-500">진행 중인 프로젝트</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <FileText className="w-8 h-8 text-indigo-600" />
                  <span className="text-xs text-gray-400">신규</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingBids}건</p>
                <p className="text-sm text-gray-500">대기 중인 입찰</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-green-600" />
                  <span className="text-xs text-gray-400">총계</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.completedProjects}건</p>
                <p className="text-sm text-gray-500">완료 프로젝트</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">⭐</span>
                  <span className="text-xs text-gray-400">평균</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
                <p className="text-sm text-gray-500">고객 평점</p>
              </div>
            </div>

            {recentEstimates.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 mb-8">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">최근 견적</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentEstimates.map((est) => (
                    <div key={est.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{est.title}</p>
                        <p className="text-xs text-gray-400">{new Date(est.created_at).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {est.grand_total ? `${Math.round(est.grand_total).toLocaleString()}원` : "-"}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          est.status === "completed" ? "bg-green-100 text-green-700" :
                          est.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {est.status === "completed" ? "완료" : est.status === "in_progress" ? "진행중" : "초안"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MENU_ITEMS.map((item) => (
                <Link key={item.label} href={item.href}
                  className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4">
                  <item.icon className="w-10 h-10 text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
