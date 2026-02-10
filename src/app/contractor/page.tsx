"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Users, Loader2, Plus, Star,
  DollarSign, Bell, Calendar, ChevronRight,
} from "lucide-react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import { NOTIFICATION_PRIORITY_COLORS } from "@/types/notification";
import type { Notification } from "@/types/notification";

interface DashboardStats {
  activeProjects: number;
  pendingBids: number;
  completedProjects: number;
  avgRating: string;
  monthlyRevenue: number;
  receivableTotal: number;
}

export default function ContractorDashboard() {
  const { contractorId, authChecked } = useContractorAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0, pendingBids: 0, completedProjects: 0, avgRating: "-",
    monthlyRevenue: 0, receivableTotal: 0,
  });
  const [recentEstimates, setRecentEstimates] = useState<{ id: string; title: string; status: string; grand_total: number; created_at: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !contractorId) return;
    async function loadDashboard() {
      try {
        const [estimateRes, notiRes] = await Promise.all([
          fetch("/api/estimates"),
          fetch(`/api/contractor/notifications?contractorId=${contractorId}`).catch(() => null),
        ]);
        const estimateData = await estimateRes.json();
        const estimates = estimateData.estimates || [];
        const notiData = notiRes ? await notiRes.json().catch(() => ({ notifications: [] })) : { notifications: [] };

        setRecentEstimates(estimates.slice(0, 5));
        setNotifications((notiData.notifications || []).slice(0, 5));
        setStats({
          activeProjects: estimates.filter((e: { status: string }) => e.status === "in_progress").length,
          pendingBids: estimates.filter((e: { status: string }) => e.status === "draft").length,
          completedProjects: estimates.filter((e: { status: string }) => e.status === "completed").length,
          avgRating: "-",
          monthlyRevenue: 0,
          receivableTotal: 0,
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [authChecked, contractorId]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">대시보드</h1>
          <p className="text-gray-500">프로젝트와 입찰을 한눈에 관리하세요</p>
        </div>
        <Link href="/address"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> 새 견적
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* 5개 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <BarChart3 className="w-7 h-7 text-blue-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}건</p>
              <p className="text-xs text-gray-500">진행 중 프로젝트</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <FileText className="w-7 h-7 text-indigo-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{stats.pendingBids}건</p>
              <p className="text-xs text-gray-500">대기 입찰</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <DollarSign className="w-7 h-7 text-red-500 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.receivableTotal)}원</p>
              <p className="text-xs text-gray-500">미수금</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <DollarSign className="w-7 h-7 text-green-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.monthlyRevenue)}원</p>
              <p className="text-xs text-gray-500">이번 달 매출</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <Star className="w-7 h-7 text-amber-500 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
              <p className="text-xs text-gray-500">평균 평점</p>
            </div>
          </div>

          {/* 빠른 액션 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "입찰 확인", href: "/contractor/bids", icon: FileText, color: "text-blue-600" },
              { label: "일정 보기", href: "/contractor/schedule", icon: Calendar, color: "text-green-600" },
              { label: "AI 비서", href: "/contractor/ai", icon: Users, color: "text-indigo-600" },
              { label: "재무 현황", href: "/contractor/finance", icon: DollarSign, color: "text-amber-600" },
            ].map((action) => (
              <Link key={action.label} href={action.href}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-3">
                <action.icon className={`w-6 h-6 ${action.color} flex-shrink-0`} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 알림 */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">알림</h2>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">새 알림이 없습니다</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((noti) => (
                    <Link key={noti.id} href={noti.link || "#"}
                      className={`px-5 py-3 flex items-start gap-3 hover:bg-gray-50 border-l-4 ${NOTIFICATION_PRIORITY_COLORS[noti.priority]}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{noti.title}</p>
                        <p className="text-xs text-gray-500 truncate">{noti.message}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 최근 견적 */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">최근 견적</h2>
              </div>
              {recentEstimates.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">견적이 없습니다</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentEstimates.map((est) => (
                    <Link key={est.id} href={`/estimate/${est.id}`}
                      className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{est.title}</p>
                        <p className="text-xs text-gray-400">{new Date(est.created_at).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {est.grand_total ? `${fmt(est.grand_total)}원` : "-"}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          est.status === "completed" ? "bg-green-100 text-green-700" :
                          est.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {est.status === "completed" ? "완료" : est.status === "in_progress" ? "진행중" : "초안"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
