"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  FileSignature,
  Bell,
  Hexagon,
  Plus,
  Search,
  Zap,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTokens } from "@/hooks/useTokens";
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
  const { balance, totalUsed, totalPurchased } = useTokens();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    activeContracts: 0,
    unreadNotifications: 0,
  });
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [projRes, contRes, notiRes] = await Promise.allSettled([
        fetch(`/api/consumer-projects?userId=${user.id}`).then((r) => r.json()),
        fetch(`/api/contracts?consumerId=${user.id}`).then((r) => r.json()),
        fetch(`/api/consumer/notifications?userId=${user.id}`).then((r) => r.json()),
      ]);

      const projects =
        projRes.status === "fulfilled" ? projRes.value.projects || [] : [];
      const contracts =
        contRes.status === "fulfilled" ? contRes.value.contracts || [] : [];
      const notifications =
        notiRes.status === "fulfilled" ? notiRes.value.notifications || [] : [];

      const activeProjectStatuses = [
        "ADDRESS_SELECTION",
        "FLOOR_PLAN",
        "AI_DESIGN",
        "RENDERING",
        "ESTIMATING",
        "RFQ",
      ];
      setStats({
        activeProjects: projects.filter((p: { status: string }) =>
          activeProjectStatuses.includes(p.status),
        ).length,
        activeContracts: contracts.filter((c: { status: string }) =>
          [
            "SIGNED",
            "IN_PROGRESS",
            "PENDING_SIGNATURE",
            "signed",
            "in_progress",
            "pending_signature",
          ].includes(c.status),
        ).length,
        unreadNotifications: notifications.filter(
          (n: { is_read?: boolean }) => !n.is_read,
        ).length,
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
        })),
      );
    } catch (err) {
      console.error("[mypage] Dashboard load error:", err);
      toast({
        type: "error",
        title: "데이터 로드 실패",
        message: "대시보드 정보를 불러올 수 없습니다",
      });
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
    {
      label: "진행중 프로젝트",
      value: stats.activeProjects,
      icon: FolderKanban,
      iconBg: "bg-primary-100 text-primary-600",
      href: "/mypage/projects",
    },
    {
      label: "활성 계약",
      value: stats.activeContracts,
      icon: FileSignature,
      iconBg: "bg-indigo-100 text-indigo-600",
      href: "/mypage/contracts",
    },
    {
      label: "새 알림",
      value: stats.unreadNotifications,
      icon: Bell,
      iconBg: "bg-emerald-100 text-emerald-600",
      href: "/mypage/notifications",
    },
    {
      label: "보유 토큰",
      value: balance,
      icon: Hexagon,
      iconBg: "bg-amber-100 text-amber-600",
      // 잔액 카드는 충전이 아니라 "어떻게 충전·사용됐는지" 로그로 — 충전은 quickActions의 토큰 충전
      href: "/mypage/billing",
    },
  ];

  const quickActions = [
    {
      label: "새 프로젝트",
      description: "AI 인테리어 견적 시작",
      icon: Plus,
      href: "/workflow",
      bg: "bg-primary-500 text-white hover:bg-primary-600",
    },
    {
      label: "업체 찾기",
      description: "검증된 시공업체 탐색",
      icon: Search,
      href: "/find-contractors",
      bg: "bg-primary-900 text-white hover:bg-primary-800",
    },
    {
      label: "토큰 충전",
      description: "AI 이미지 생성 토큰",
      icon: Zap,
      href: "/account/tokens",
      bg: "bg-amber-500 text-white hover:bg-amber-600",
    },
    {
      label: "고객센터",
      description: "도움이 필요하신가요?",
      icon: HelpCircle,
      href: "/mypage/support",
      bg: "bg-zinc-700 text-white hover:bg-zinc-800",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* 인사 배너 — InPick 톤 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-400 to-amber-400 p-7 text-white shadow-card">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-amber-200/30 blur-2xl" />
        <div className="relative">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white/70">
            마이페이지
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tightest">
            안녕하세요, {displayName}님
          </h1>
          <p className="mt-2 text-sm text-white/85">
            인테리어 프로젝트를 관리하고 진행 상황을 확인하세요.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-[0.78rem]">
            <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              <span className="font-bold tabular">{balance}</span> 토큰 보유
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              누적 사용 <span className="font-bold tabular">{totalUsed}</span>
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              누적 충전 <span className="font-bold tabular">{totalPurchased}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4개 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-2xl border border-primary-100 bg-white px-5 py-5 shadow-card transition-all hover:border-primary-300 hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <card.icon className="h-4 w-4" />
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-primary-900/30 group-hover:text-primary-500 transition-colors" />
            </div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/40">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular tracking-tighter text-primary-900">
              {loading ? (
                <span className="inline-block w-10 h-7 bg-primary-100 rounded animate-pulse" />
              ) : (
                card.value.toLocaleString()
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* 최근 알림 */}
        <div className="rounded-2xl border border-primary-100 bg-white shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-primary-100 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-primary-900">
              최근 알림
            </h2>
            <Link
              href="/mypage/notifications"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              전체 보기 →
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-primary-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="w-8 h-8 mx-auto mb-2 text-primary-200" />
              <p className="text-sm text-primary-900/40">새 알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-primary-50">
              {recentNotifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/mypage/notifications"}
                  className={`px-5 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-colors ${
                    !n.isRead ? "bg-amber-50/30" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${!n.isRead ? "font-bold text-primary-900" : "text-primary-900/70"}`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-primary-900/40 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="rounded-2xl border border-primary-100 bg-white shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-primary-100">
            <h2 className="text-sm font-bold tracking-tight text-primary-900">
              빠른 액션
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`relative rounded-xl p-4 transition-all hover:scale-[1.02] ${action.bg}`}
              >
                <action.icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-bold">{action.label}</p>
                <p className="text-[0.7rem] opacity-80 mt-0.5">
                  {action.description}
                </p>
                <ChevronRight className="absolute right-3 top-3 w-4 h-4 opacity-50" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
