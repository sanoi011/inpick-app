"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PromotionalBannerSlot from "@/components/business/PromotionalBannerSlot";
import {
  BarChart3, Bell, Calendar, Check, ChevronRight, Circle, DollarSign,
  FileText, Loader2, Plus, Sparkles, Star, Users,
} from "lucide-react";
import { useContractorAuth } from "@/hooks/useContractorAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "@/components/ui/Toast";
import { NOTIFICATION_PRIORITY_COLORS } from "@/types/notification";
import type { Notification } from "@/types/notification";
import { CONTRACTOR_BIDDING_ENABLED } from "@/lib/features";
import {
  getContractorProfileReadiness,
  type ContractorProfileReadiness,
} from "@/lib/contractor-experience";

interface DashboardStats {
  activeProjects: number;
  pendingBids: number;
  completedProjects: number;
  avgRating: string;
  monthlyRevenue: number;
  receivableTotal: number;
}

export default function ContractorDashboard() {
  const { contractorId, contractorName, authChecked, authFetch } = useContractorAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0, pendingBids: 0, completedProjects: 0, avgRating: "-",
    monthlyRevenue: 0, receivableTotal: 0,
  });
  const [recentEstimates, setRecentEstimates] = useState<{ id: string; title: string; status: string; grand_total: number; created_at: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeProjects, setActiveProjects] = useState<{ id: string; name: string; progressPct: number; phases: { status: string; color: string }[] }[]>([]);
  const [profileReadiness, setProfileReadiness] = useState<ContractorProfileReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !contractorId) return;
    async function loadDashboard() {
      try {
        const [statsRes, estimateRes, notiRes, projRes, profileRes] = await Promise.all([
          authFetch(`/api/contractor/stats?contractorId=${contractorId}`).catch(() => null),
          authFetch("/api/estimates?status=confirmed&region="),
          authFetch(`/api/contractor/notifications?contractorId=${contractorId}`).catch(() => null),
          authFetch(`/api/contractor/projects?contractorId=${contractorId}&status=in_progress`).catch(() => null),
          authFetch(`/api/contractor/profile?contractorId=${contractorId}`).catch(() => null),
        ]);
        const statsData = statsRes ? await statsRes.json().catch(() => null) : null;
        const estimateData = await estimateRes.json();
        const estimates = estimateData.estimates || [];
        const notiData = notiRes ? await notiRes.json().catch(() => ({ notifications: [] })) : { notifications: [] };

        const projData = projRes ? await projRes.json().catch(() => ({ projects: [] })) : { projects: [] };
        const profileData = profileRes ? await profileRes.json().catch(() => null) : null;
        const contractor = profileData?.contractor;
        if (contractor) {
          setProfileReadiness(getContractorProfileReadiness({
            companyName: contractor.company_name,
            phone: contractor.phone,
            region: contractor.region,
            introduction: contractor.introduction || contractor.description,
            licenseNumber: contractor.license_number,
            businessLicenseUrl: contractor.business_license_url,
            tradesCount: Array.isArray(contractor.contractor_trades) ? contractor.contractor_trades.length : 0,
            portfolioCount: Array.isArray(contractor.contractor_portfolio) ? contractor.contractor_portfolio.length : 0,
            isPublic: contractor.is_public === true,
          }));
        }
        const projList = (projData.projects || []).slice(0, 3).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          progressPct: typeof p.progress_pct === "number" ? p.progress_pct : 0,
          phases: ((p.project_phases || []) as Record<string, unknown>[])
            .sort((a, b) => (a.phase_order as number) - (b.phase_order as number))
            .map((ph) => ({
              status: ph.status as string,
              color: (ph.color as string) || "#6B7280",
            })),
        }));
        setActiveProjects(projList);
        setRecentEstimates(estimates.slice(0, 5));
        setNotifications((notiData.notifications || []).slice(0, 5));
        setStats({
          activeProjects: statsData?.activeProjects ?? estimates.filter((e: { status: string }) => e.status === "in_progress").length,
          pendingBids: statsData?.pendingBids ?? estimates.filter((e: { status: string }) => e.status === "confirmed" || e.status === "draft").length,
          completedProjects: statsData?.completedProjects ?? estimates.filter((e: { status: string }) => e.status === "completed").length,
          avgRating: statsData?.avgRating ?? "-",
          monthlyRevenue: statsData?.monthlyRevenue ?? 0,
          receivableTotal: statsData?.receivableTotal ?? 0,
        });
      } catch {
        toast({ type: "error", title: "오류", message: "대시보드를 불러올 수 없습니다" });
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [authChecked, authFetch, contractorId]);

  // Realtime: 새 알림 수신 시 토스트 + 목록 업데이트
  useRealtimeSubscription({
    table: "contractor_notifications",
    filter: contractorId ? `contractor_id=eq.${contractorId}` : undefined,
    event: "INSERT",
    enabled: !!contractorId,
    onInsert: (payload) => {
      const n = payload as Record<string, unknown>;
      toast({
        type: n.priority === "HIGH" ? "warning" : "info",
        title: (n.title as string) || "새 알림",
        message: (n.message as string) || "",
      });
      const newNotification: Notification = {
        id: (n.id as string) || "",
        contractorId: (n.contractor_id as string) || "",
        type: ((n.type as string) || "SYSTEM") as Notification["type"],
        title: (n.title as string) || "",
        message: (n.message as string) || "",
        priority: ((n.priority as string) || "MEDIUM") as Notification["priority"],
        isRead: false,
        link: (n.link as string) || undefined,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNotification, ...prev].slice(0, 5));
    },
  });

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="relative mb-6 overflow-hidden rounded-[30px] border border-black/[0.07] bg-white p-6 sm:p-8">
        <span className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#fff1ec]" />
        <span className="absolute right-24 top-16 h-12 w-12 rotate-12 rounded-2xl bg-[#f0edff]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.15em] text-[#f15b4a]">
              <Sparkles className="h-3.5 w-3.5" /> TODAY AT INPICK
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-black">
              {contractorName ? `${contractorName}의 오늘` : "오늘의 작업 공간"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-black/48">
              {CONTRACTOR_BIDDING_ENABLED ? "프로필 준비, 고객 요청, 프로젝트와 입찰을 순서대로 확인하세요." : "프로필 준비, 고객 요청과 진행 중인 프로젝트를 순서대로 확인하세요."}
            </p>
          </div>
          <Link href="/address" className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-black/80">
            <Plus className="h-4 w-4" /> 새 견적
          </Link>
        </div>
      </section>

      <PromotionalBannerSlot placement="contractor_dashboard_top" className="mb-6" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {profileReadiness && (
            <section className="mb-6 grid gap-4 rounded-[28px] border border-black/[0.07] bg-white p-5 lg:grid-cols-[0.75fr_1.25fr] lg:p-6">
              <div className="rounded-[22px] bg-[#f7f7f5] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.12em] text-black/35">PROFILE CHECK</p>
                    <h2 className="mt-2 text-lg font-black">{profileReadiness.label}</h2>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black tabular-nums">{profileReadiness.percent}%</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/[0.08]">
                  <div className="h-full rounded-full bg-[#f15b4a] transition-all" style={{ width: `${profileReadiness.percent}%` }} />
                </div>
                <p className="mt-3 text-xs leading-5 text-black/45">
                  {profileReadiness.completed}/{profileReadiness.total}개 항목 입력 완료 · 인증 여부나 선정 가능성을 뜻하지 않아요.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black">오늘 채울 프로필</h2>
                  <Link href="/contractor/profile" className="inline-flex items-center gap-1 text-[11px] font-bold text-black/50 hover:text-black">
                    전체 설정 <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {profileReadiness.items.map((item) => (
                    <Link key={item.id} href={item.href} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${item.complete ? "border-transparent bg-[#eaf8f1]" : "border-black/[0.07] hover:border-black/20"}`}>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.complete ? "bg-white text-[#197455]" : "bg-[#fff1ec] text-[#b83e2f]"}`}>
                        {item.complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-black/42">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className={`mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 ${CONTRACTOR_BIDDING_ENABLED ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
              <BarChart3 className="w-7 h-7 text-primary-500 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}건</p>
              <p className="text-xs text-gray-500">진행 중 프로젝트</p>
            </div>
            {CONTRACTOR_BIDDING_ENABLED && (
              <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
                <FileText className="w-7 h-7 text-indigo-600 mb-3" />
                <p className="text-2xl font-bold text-gray-900">{stats.pendingBids}건</p>
                <p className="text-xs text-gray-500">대기 입찰</p>
              </div>
            )}
            <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
              <DollarSign className="w-7 h-7 text-red-500 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.receivableTotal)}원</p>
              <p className="text-xs text-gray-500">미수금</p>
            </div>
            <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
              <DollarSign className="w-7 h-7 text-green-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.monthlyRevenue)}원</p>
              <p className="text-xs text-gray-500">이번 달 매출</p>
            </div>
            <div className="rounded-[22px] border border-black/[0.07] bg-white p-5">
              <Star className="w-7 h-7 text-amber-500 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
              <p className="text-xs text-gray-500">평균 평점</p>
            </div>
          </div>

          {/* 빠른 액션 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[
              ...(CONTRACTOR_BIDDING_ENABLED
                ? [{ label: "입찰 확인", href: "/contractor/bids", icon: FileText, color: "text-primary-500" }]
                : []),
              { label: "일정 보기", href: "/contractor/schedule", icon: Calendar, color: "text-green-600" },
              { label: "AI 비서", href: "/contractor/ai", icon: Users, color: "text-indigo-600" },
              { label: "재무 현황", href: "/contractor/finance", icon: DollarSign, color: "text-amber-600" },
            ].map((action) => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 rounded-[20px] border border-black/[0.07] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-sm">
                <action.icon className={`w-6 h-6 ${action.color} flex-shrink-0`} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </Link>
            ))}
          </div>

          {/* 활성 프로젝트 미니 공정 진행률 */}
          {activeProjects.length > 0 && (
            <div className="rounded-[26px] border border-black/[0.07] bg-white mb-8">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary-500" /> 진행 중 프로젝트
                </h2>
                <Link href="/contractor/projects" className="text-xs text-primary-500 hover:underline flex items-center gap-1">
                  전체 보기 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {activeProjects.map((proj) => (
                  <Link key={proj.id} href="/contractor/projects" className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{proj.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{proj.progressPct}% 완료</p>
                    </div>
                    <div className="flex rounded-full overflow-hidden h-2.5 w-40 bg-gray-100 flex-shrink-0">
                      {proj.phases.length > 0 ? proj.phases.map((ph, i) => (
                        <div key={i} className="transition-all" style={{
                          width: `${100 / proj.phases.length}%`,
                          backgroundColor: ph.color || "#6B7280",
                          opacity: ph.status === "completed" ? 1 : ph.status === "in_progress" ? 0.6 : 0.2,
                        }} />
                      )) : (
                        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${proj.progressPct}%` }} />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 알림 */}
            <div className="rounded-[26px] border border-black/[0.07] bg-white">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">알림</h2>
                  {notifications.filter((n) => !n.isRead).length > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] text-center">
                      {notifications.filter((n) => !n.isRead).length}
                    </span>
                  )}
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
            <div className="rounded-[26px] border border-black/[0.07] bg-white">
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
                          est.status === "in_progress" ? "bg-primary-100 text-primary-700" :
                          est.status === "confirmed" ? "bg-purple-100 text-purple-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {est.status === "completed" ? "완료" : est.status === "in_progress" ? "진행중" : est.status === "confirmed" ? (CONTRACTOR_BIDDING_ENABLED ? "입찰중" : "검토중") : "초안"}
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
