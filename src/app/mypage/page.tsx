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
    const createdAt = new Date(dateStr).getTime();
    if (!Number.isFinite(createdAt)) return "최근";
    const diff = Date.now() - createdAt;
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
      href: "/mypage/projects",
    },
    {
      label: "활성 계약",
      value: stats.activeContracts,
      icon: FileSignature,
      href: "/mypage/contracts",
    },
    {
      label: "새 알림",
      value: stats.unreadNotifications,
      icon: Bell,
      href: "/mypage/notifications",
    },
    {
      label: "보유 토큰",
      value: balance,
      icon: Hexagon,
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
      primary: true,
    },
    {
      label: "업체 찾기",
      description: "검증된 시공업체 탐색",
      icon: Search,
      href: "/find-contractors",
      primary: false,
    },
    {
      label: "토큰 충전",
      description: "AI 이미지 생성 토큰",
      icon: Zap,
      href: "/account/tokens",
      primary: false,
    },
    {
      label: "고객센터",
      description: "도움이 필요하신가요?",
      icon: HelpCircle,
      href: "/mypage/support",
      primary: false,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <section className="flex flex-col justify-between gap-6 rounded-[28px] border border-black/[0.07] bg-white p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">MY INPICK</p>
          <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-[-0.055em] sm:text-[38px]">
            안녕하세요, {displayName}님
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/48">프로젝트와 계약 진행 상황을 한눈에 확인하세요.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-black/58">
            <span className="rounded-full bg-[#f4f4f2] px-3 py-1.5"><b className="font-semibold text-black">{balance}</b> 토큰 보유</span>
            <span className="rounded-full bg-[#f4f4f2] px-3 py-1.5">누적 사용 <b className="font-semibold text-black">{totalUsed}</b></span>
            <span className="rounded-full bg-[#f4f4f2] px-3 py-1.5">누적 충전 <b className="font-semibold text-black">{totalPurchased}</b></span>
          </div>
        </div>
        <Link href="/workflow" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0d0d0d] px-5 text-sm font-medium text-white transition hover:bg-black/80">
          <Plus className="h-4 w-4" />무료 인테리어 디자인
        </Link>
      </section>

      {/* 4개 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-[22px] border border-black/[0.07] bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/20"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f2] text-black/70"><card.icon className="h-4 w-4" strokeWidth={1.8} /></span>
              <ChevronRight className="h-3.5 w-3.5 text-black/20 transition-colors group-hover:text-black/70" />
            </div>
            <p className="text-[11px] font-medium text-black/42">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.04em]">
              {loading ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-black/[0.07]" />
              ) : (
                card.value.toLocaleString()
              )}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 최근 알림 */}
        <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold tracking-[-0.02em]">
              최근 알림
            </h2>
            <Link
              href="/mypage/notifications"
              className="text-xs font-medium text-black/46 hover:text-black"
            >
              전체 보기 →
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-black/[0.045]" />
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-black/18" strokeWidth={1.5} />
              <p className="text-sm text-black/40">새 알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {recentNotifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/mypage/notifications"}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.025] ${
                    !n.isRead ? "bg-[#f7f7f5]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate text-sm ${!n.isRead ? "font-semibold" : "text-black/64"}`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-black/36">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#0d0d0d]" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold tracking-[-0.02em]">
              빠른 액션
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-4">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`relative rounded-2xl border p-4 transition hover:-translate-y-0.5 ${action.primary ? "border-[#0d0d0d] bg-[#0d0d0d] text-white" : "border-black/[0.07] bg-[#f7f7f5] text-[#0d0d0d] hover:border-black/20"}`}
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
