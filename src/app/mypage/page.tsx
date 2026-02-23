"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban, FileSignature, Bell, CreditCard,
  Plus, Search, Zap, HelpCircle, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "@/components/ui/Toast";

interface DashboardStats {
  activeProjects: number;
  activeContracts: number;
  unreadNotifications: number;
}

interface RecentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  link?: string;
}

export default function MyPageDashboard() {
  const { user } = useAuth();
  const { credits } = useCredits();
  const [stats, setStats] = useState<DashboardStats>({ activeProjects: 0, activeContracts: 0, unreadNotifications: 0 });
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [projRes, contRes, notiRes] = await Promise.allSettled([
        fetch(`/api/consumer-projects?userId=${user.id}`).then(r => r.json()),
        fetch(`/api/contracts?consumerId=${user.id}`).then(r => r.json()),
        fetch(`/api/consumer/notifications?userId=${user.id}`).then(r => r.json()),
      ]);

      const projects = projRes.status === "fulfilled" ? (projRes.value.projects || []) : [];
      const contracts = contRes.status === "fulfilled" ? (contRes.value.contracts || []) : [];
      const notifications = notiRes.status === "fulfilled" ? (notiRes.value.notifications || []) : [];

      const activeProjectStatuses = ["ADDRESS_SELECTION", "FLOOR_PLAN", "AI_DESIGN", "RENDERING", "ESTIMATING", "RFQ"];
      setStats({
        activeProjects: projects.filter((p: { status: string }) => activeProjectStatuses.includes(p.status)).length,
        activeContracts: contracts.filter((c: { status: string }) => ["SIGNED", "IN_PROGRESS", "PENDING_SIGNATURE"].includes(c.status)).length,
        unreadNotifications: notifications.filter((n: { is_read?: boolean }) => !n.is_read).length,
      });

      setRecentNotifications(
        notifications.slice(0, 5).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          title: n.title as string,
          message: n.message as string,
          type: n.type as string,
          createdAt: n.created_at as string,
          isRead: n.is_read as boolean,
          link: n.link as string | undefined,
        }))
      );
    } catch (err) {
      console.error("[mypage] Dashboard load error:", err);
      toast({ type: "error", title: "데이터 로드 실패", message: "대시보드 정보를 불러올 수 없습니다" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  const summaryCards = [
    { label: "진행중 프로젝트", value: stats.activeProjects, icon: FolderKanban, color: "bg-blue-50 text-blue-700 border-blue-200", iconColor: "text-blue-500", href: "/mypage/projects" },
    { label: "활성 계약", value: stats.activeContracts, icon: FileSignature, color: "bg-indigo-50 text-indigo-700 border-indigo-200", iconColor: "text-indigo-500", href: "/mypage/contracts" },
    { label: "새 알림", value: stats.unreadNotifications, icon: Bell, color: "bg-amber-50 text-amber-700 border-amber-200", iconColor: "text-amber-500", href: "/mypage/notifications" },
    { label: "보유 크레딧", value: credits?.balance || 0, icon: CreditCard, color: "bg-green-50 text-green-700 border-green-200", iconColor: "text-green-500", href: "/mypage/account" },
  ];

  const quickActions = [
    { label: "새 프로젝트", description: "AI 인테리어 견적 시작", icon: Plus, href: "/project/new", color: "bg-blue-600 text-white hover:bg-blue-700" },
    { label: "업체 찾기", description: "검증된 시공업체 탐색", icon: Search, href: "/find-contractors", color: "bg-indigo-600 text-white hover:bg-indigo-700" },
    { label: "크레딧 충전", description: "AI 이미지 생성 크레딧", icon: Zap, href: "/mypage/account", color: "bg-green-600 text-white hover:bg-green-700" },
    { label: "고객센터", description: "도움이 필요하신가요?", icon: HelpCircle, href: "/mypage/support", color: "bg-gray-600 text-white hover:bg-gray-700" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* 인사 배너 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">안녕하세요, {displayName}님</h1>
        <p className="text-blue-100 text-sm">인테리어 프로젝트를 관리하고 진행 상황을 확인하세요.</p>
      </div>

      {/* 4개 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`px-4 py-4 rounded-xl border transition-shadow hover:shadow-md ${card.color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              <p className="text-xs font-medium opacity-80">{card.label}</p>
            </div>
            <p className="text-2xl font-bold">
              {loading ? (
                <span className="inline-block w-8 h-7 bg-current/10 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 최근 활동 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">최근 알림</h2>
            <Link href="/mypage/notifications" className="text-xs text-blue-600 hover:text-blue-800">
              전체 보기
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              새 알림이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentNotifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/mypage/notifications"}
                  className={`px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    !n.isRead ? "bg-blue-50/30" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">빠른 액션</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`rounded-xl p-4 transition-all hover:scale-[1.02] ${action.color}`}
              >
                <action.icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-bold">{action.label}</p>
                <p className="text-xs opacity-80 mt-0.5">{action.description}</p>
                <ChevronRight className="w-4 h-4 mt-2 opacity-60" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
