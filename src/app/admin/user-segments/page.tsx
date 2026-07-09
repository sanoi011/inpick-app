"use client";

/**
 * 관리자 — 로그인 제공사별 유저 분석
 *  · 활동데이터(analytics_events)와 감성데이터(user_material_events)를
 *    google/kakao/naver/apple/email 제공사별로 세분화.
 *  · 인구통계(성별/연령대)는 provider 동의 승인 시에만 채워짐 → 커버리지% 표시.
 */
import { useCallback, useEffect, useState } from "react";
import { Users, Activity, Heart, PieChart, Loader2, Info } from "lucide-react";

type Period = "today" | "week" | "month";

interface ProviderRow {
  provider: string;
  userCount: number;
  activeUsers: number;
  activity: Record<string, number>;
  emotion: { events: number; topMoods: [string, number][]; topPalettes: [string, number][] };
  demographics: {
    withGender: number;
    withAge: number;
    genderCoverage: number;
    gender: Record<string, number>;
    ageRange: [string, number][];
  };
}
interface ApiResp {
  period: string;
  totalUsers: number;
  activityLabels: Record<string, string>;
  providers: ProviderRow[];
  error?: string;
}

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  google: { label: "Google", color: "#4285F4", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  kakao: { label: "카카오", color: "#FEE500", bg: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  naver: { label: "네이버", color: "#03C75A", bg: "bg-green-50 text-green-700 border-green-200" },
  apple: { label: "Apple", color: "#111", bg: "bg-gray-100 text-gray-800 border-gray-300" },
  email: { label: "이메일", color: "#9333EA", bg: "bg-purple-50 text-purple-700 border-purple-200" },
};

export default function UserSegmentsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const r = await fetch(`/api/admin/analytics/by-provider?period=${period}`, { headers });
      setData(await r.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = (data?.providers ?? []).filter((p) => p.userCount > 0 || p.activity);
  const activityLabels = data?.activityLabels ?? {};
  const maxUser = Math.max(1, ...providers.map((p) => p.userCount));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">로그인 제공사별 유저 분석</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-md ${period === p ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {p === "today" ? "오늘" : p === "week" ? "7일" : "30일"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        활동데이터(analytics_events) · 감성데이터(user_material_events)를 제공사별로 분해. 성별/연령대는 제공사 동의항목 승인 시 채워집니다.
      </p>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
      ) : !data || data.error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          데이터를 불러오지 못했습니다{data?.error ? ` (${data.error})` : ""}.
        </div>
      ) : (
        <div className="space-y-6">
          {/* 제공사별 유저 분포 */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">가입 유저 분포</h2>
              <span className="text-xs text-gray-400">총 {data.totalUsers.toLocaleString()}명</span>
            </div>
            <div className="space-y-2.5">
              {providers.map((p) => {
                const meta = PROVIDER_META[p.provider];
                const pct = data.totalUsers ? Math.round((p.userCount / data.totalUsers) * 100) : 0;
                return (
                  <div key={p.provider} className="flex items-center gap-3">
                    <span className={`w-16 shrink-0 text-center text-xs font-bold rounded-md border px-1.5 py-1 ${meta.bg}`}>{meta.label}</span>
                    <div className="flex-1 h-6 rounded-md bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${(p.userCount / maxUser) * 100}%`, backgroundColor: meta.color, minWidth: p.userCount ? 4 : 0 }} />
                    </div>
                    <span className="w-24 text-right text-xs tabular-nums text-gray-600">{p.userCount.toLocaleString()}명 ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 활동데이터 (제공사 × 이벤트) */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">활동 데이터</h2>
              <span className="text-xs text-gray-400">기간 내 이벤트 수</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">제공사</th>
                  <th className="text-right px-2 font-medium">활성</th>
                  {Object.entries(activityLabels).map(([k, label]) => (
                    <th key={k} className="text-right px-2 font-medium whitespace-nowrap">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const meta = PROVIDER_META[p.provider];
                  return (
                    <tr key={p.provider} className="border-b border-gray-50">
                      <td className="py-2 pr-3"><span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${meta.bg}`}>{meta.label}</span></td>
                      <td className="text-right px-2 tabular-nums font-semibold text-gray-800">{p.activeUsers}</td>
                      {Object.keys(activityLabels).map((k) => (
                        <td key={k} className="text-right px-2 tabular-nums text-gray-600">{p.activity[k] ? p.activity[k].toLocaleString() : "·"}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* 감성데이터 (제공사별 무드/팔레트) */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">감성 데이터</h2>
              <span className="text-xs text-gray-400">자재·디자인 선택 시그널</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.filter((p) => p.emotion.events > 0).map((p) => {
                const meta = PROVIDER_META[p.provider];
                return (
                  <div key={p.provider} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${meta.bg}`}>{meta.label}</span>
                      <span className="text-xs text-gray-400">{p.emotion.events} 이벤트</span>
                    </div>
                    <div className="text-[11px] text-gray-600 space-y-0.5">
                      {p.emotion.topMoods.length > 0 ? p.emotion.topMoods.map(([m, c]) => (
                        <div key={m} className="flex justify-between"><span>{m}</span><span className="tabular-nums text-gray-400">{c}</span></div>
                      )) : <span className="text-gray-300">무드 데이터 없음</span>}
                    </div>
                  </div>
                );
              })}
              {providers.every((p) => p.emotion.events === 0) && (
                <p className="text-xs text-gray-400 col-span-full py-6 text-center">
                  아직 감성 이벤트가 없습니다. (user_material_events — POST /api/user-events 로 수집)
                </p>
              )}
            </div>
          </section>

          {/* 인구통계 (성별/연령대) */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900">인구통계 (성별 · 연령대)</h2>
            </div>
            <div className="flex items-start gap-1.5 mb-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
              <Info className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>성별/연령대는 카카오·네이버 동의항목 승인 시에만 수집됩니다. Google·Apple은 미제공. 아래는 수집 커버리지 기준.</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => {
                const meta = PROVIDER_META[p.provider];
                const g = p.demographics.gender;
                return (
                  <div key={p.provider} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${meta.bg}`}>{meta.label}</span>
                      <span className="text-[11px] text-gray-400">수집 {p.demographics.genderCoverage}%</span>
                    </div>
                    {p.demographics.withGender > 0 || p.demographics.withAge > 0 ? (
                      <div className="text-[11px] text-gray-600 space-y-1">
                        <div className="flex justify-between"><span>남 / 여</span><span className="tabular-nums text-gray-500">{g.male ?? 0} / {g.female ?? 0}</span></div>
                        {p.demographics.ageRange.map(([a, c]) => (
                          <div key={a} className="flex justify-between"><span>{a}세</span><span className="tabular-nums text-gray-400">{c}</span></div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-300">수집된 인구통계 없음</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
