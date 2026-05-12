"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Users,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Loader2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface OverviewData {
  period: string;
  cards: {
    activeUsers: number;
    signups: number;
    workflowStarts: number;
    chatSent: number;
    imageRequested: number;
    imageCompleted: number;
    imageFailed: number;
    imageSuccessRate: number | null;
    estimateRequested: number;
    estimateGenerated: number;
    rfqCreated: number;
    bidSubmitted: number;
    contractsCreated: number;
    avgReadiness: number;
  };
  aiHealth: Array<{
    endpoint: string;
    requested: number;
    completed: number;
    failed: number;
    failureRate: number;
  }>;
  missingFieldsTop10: Array<{ field: string; count: number }>;
}

interface FunnelStep {
  name: string;
  event: string;
  users: number;
  conversionFromStart: number;
}

interface FunnelsData {
  overall: FunnelStep[];
  byMode: {
    apartment: FunnelStep[];
    photo_only: FunnelStep[];
    commercial: FunnelStep[];
  };
  commercialByBusiness: Array<{ businessType: string; count: number }>;
}

export default function AdminAnalyticsPage() {
  const { authChecked } = useAdminAuth();
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [funnels, setFunnels] = useState<FunnelsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "funnels" | "events">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
      };
      const [ovRes, funRes] = await Promise.all([
        fetch(`/api/admin/analytics/overview?period=${period}`, { headers }),
        fetch(`/api/admin/analytics/funnels?period=${period}`, { headers }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (funRes.ok) setFunnels(await funRes.json());
    } catch (err) {
      console.error("[analytics-page] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (authChecked) fetchData();
  }, [authChecked, fetchData]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">행동 분석 대시보드</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            analytics_events 레저 기반 / internal_user 제외
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {p === "today" ? "오늘" : p === "week" ? "최근 7일" : "최근 30일"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["overview", "funnels", "events"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {t === "overview" ? "개요" : t === "funnels" ? "퍼널" : "이벤트 탐색"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 로딩 중...
        </div>
      )}

      {/* Overview tab */}
      {tab === "overview" && overview && (
        <>
          {/* 핵심 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card
              icon={<Users className="w-4 h-4 text-blue-600" />}
              label="활성 사용자"
              value={overview.cards.activeUsers.toLocaleString()}
            />
            <Card
              icon={<Users className="w-4 h-4 text-green-600" />}
              label="신규 가입"
              value={overview.cards.signups.toLocaleString()}
            />
            <Card
              icon={<Activity className="w-4 h-4 text-amber-600" />}
              label="워크플로 시작"
              value={overview.cards.workflowStarts.toLocaleString()}
            />
            <Card
              icon={<MessageSquare className="w-4 h-4 text-purple-600" />}
              label="AI 채팅"
              value={overview.cards.chatSent.toLocaleString()}
            />
            <Card
              icon={<ImageIcon className="w-4 h-4 text-rose-600" />}
              label="이미지 생성 성공률"
              value={
                overview.cards.imageSuccessRate != null
                  ? `${Math.round(overview.cards.imageSuccessRate * 100)}%`
                  : "—"
              }
              subtitle={`${overview.cards.imageCompleted}/${overview.cards.imageRequested}`}
            />
            <Card
              icon={<FileText className="w-4 h-4 text-emerald-600" />}
              label="견적 생성"
              value={overview.cards.estimateGenerated.toLocaleString()}
              subtitle={`요청 ${overview.cards.estimateRequested.toLocaleString()}`}
            />
            <Card
              icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
              label="RFQ 발송"
              value={overview.cards.rfqCreated.toLocaleString()}
            />
            <Card
              icon={<TrendingUp className="w-4 h-4 text-pink-600" />}
              label="계약 체결"
              value={overview.cards.contractsCreated.toLocaleString()}
              subtitle={`입찰 ${overview.cards.bidSubmitted}`}
            />
          </div>

          {/* AI 엔드포인트 건강도 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              AI 엔드포인트 건강도
            </h3>
            {overview.aiHealth.length === 0 ? (
              <p className="text-xs text-gray-400">데이터 없음</p>
            ) : (
              <div className="space-y-2">
                {overview.aiHealth.map((h) => (
                  <div
                    key={h.endpoint}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-gray-600 truncate flex-1">
                      {h.endpoint}
                    </span>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>요청 {h.requested}</span>
                      <span className="text-emerald-600">✓ {h.completed}</span>
                      <span className="text-red-500">✗ {h.failed}</span>
                      <span
                        className={`font-semibold ${
                          h.failureRate > 0.1
                            ? "text-red-600"
                            : h.failureRate > 0.05
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        실패율 {(h.failureRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 견적 누락 원인 TOP 10 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              견적 누락 원인 TOP 10
            </h3>
            {overview.missingFieldsTop10.length === 0 ? (
              <p className="text-xs text-gray-400">
                데이터 없음 — readiness 이벤트 수집 시작 후 표시
              </p>
            ) : (
              <div className="space-y-1.5">
                {overview.missingFieldsTop10.map((m) => (
                  <div
                    key={m.field}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-700">{m.field}</span>
                    <span className="font-semibold text-amber-700">
                      {m.count}건
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Funnels tab */}
      {tab === "funnels" && funnels && (
        <>
          <FunnelChart title="전체 사용자 퍼널" steps={funnels.overall} />
          <div className="grid lg:grid-cols-3 gap-4">
            <FunnelChart title="아파트 도면" steps={funnels.byMode.apartment} />
            <FunnelChart title="내 공간 사진" steps={funnels.byMode.photo_only} />
            <FunnelChart title="상가·사무실" steps={funnels.byMode.commercial} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              상가 업종별 진입 횟수
            </h3>
            {funnels.commercialByBusiness.length === 0 ? (
              <p className="text-xs text-gray-400">데이터 없음</p>
            ) : (
              <div className="space-y-1.5">
                {funnels.commercialByBusiness.map((b) => (
                  <div
                    key={b.businessType}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-700">{b.businessType}</span>
                    <span className="font-semibold text-emerald-700">
                      {b.count}건
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Events tab */}
      {tab === "events" && (
        <EventExplorer authChecked={authChecked} />
      )}
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-0.5 text-[10px] text-gray-400">{subtitle}</p>}
    </div>
  );
}

function FunnelChart({
  title,
  steps,
}: {
  title: string;
  steps: FunnelStep[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.users));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-900 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {steps.map((s, i) => {
          const widthPct = (s.users / max) * 100;
          return (
            <div key={s.event}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-gray-600">{s.name}</span>
                <span className="font-semibold text-gray-900">
                  {s.users.toLocaleString()}
                  {i > 0 && (
                    <span className="ml-1 text-[10px] text-gray-400">
                      ({Math.round(s.conversionFromStart * 100)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventExplorer({ authChecked }: { authChecked: boolean }) {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventName) params.set("eventName", eventName);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/analytics/events?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("[event-explorer] error", err);
    } finally {
      setLoading(false);
    }
  }, [eventName]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <input
          type="text"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="이벤트명 (예: image_generation_completed)"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary-400"
        />
        <button
          onClick={load}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg"
        >
          검색
        </button>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400">
          이벤트가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2">시각</th>
                <th className="px-3 py-2">이벤트</th>
                <th className="px-3 py-2">actor</th>
                <th className="px-3 py-2">mode</th>
                <th className="px-3 py-2">user/project</th>
                <th className="px-3 py-2">props (요약)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id as string} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(e.occurred_at as string).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">
                    {e.event_name as string}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">
                      {e.actor_type as string}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {(e.project_mode as string) || "-"}
                  </td>
                  <td className="px-3 py-2 text-[10px] font-mono text-gray-400">
                    {((e.user_id as string) || (e.anonymous_id as string) || "-").slice(0, 8)}
                    {e.project_id ? ` / ${(e.project_id as string).slice(0, 8)}` : ""}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 max-w-xs truncate">
                    {JSON.stringify(e.props)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
