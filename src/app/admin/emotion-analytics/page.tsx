"use client";

import { useEffect, useState } from "react";
import { Heart, Activity, Clock, ArrowRightLeft, MessageSquare, AlertCircle, Loader2 } from "lucide-react";

interface Overview {
  totalEvents: number;
  distinctPalettes: number;
  distinctMoods: number;
  emptyHint?: string | null;
}

interface StatsResponse {
  overview:          Overview;
  byEvent:           Record<string, number>;
  byPalette:         { id: string; count: number }[];
  byMood:            { mood: string; count: number }[];
  avgDwellByEmotion: { mood: string; n: number; avgMs: number }[];
  topSwaps:          { from: string; to: string; count: number; palette?: string }[];
  recentFeedback:    { feedback_text: string; emotion_signal: string | null; emotion_score: number | null; created_at: string }[];
  error?:            string;
  detail?:           string;
}

export default function EmotionAnalyticsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    fetch("/api/admin/emotion-stats", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-gray-600">통계 로드 실패</div>
    );
  }

  const ov = stats.overview;
  const isEmpty = !ov.totalEvents;

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Heart className="w-7 h-7 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold">감성 분석 대시보드</h1>
          <p className="text-sm text-gray-500">사용자 자재 선택 행동·교체 패턴·감정 시그널 누적 분석</p>
        </div>
      </div>

      {/* 빈 상태 안내 */}
      {isEmpty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">아직 행동 이벤트가 수집되지 않았습니다</p>
            <p>{ov.emptyHint || "사용자가 프로젝트 워크플로우에서 자재를 선택·교체·확정하면 여기 통계가 쌓입니다."}</p>
            <p className="mt-2 text-xs text-amber-700">
              연동: <code className="px-1.5 py-0.5 bg-amber-100 rounded">POST /api/user-events</code> (event_type: swap/dwell/confirm/impression/reject/emotion_feedback)
            </p>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Activity}       label="전체 이벤트"      value={ov.totalEvents}      color="red" />
        <StatCard icon={Heart}          label="활성 감성 태그"    value={ov.distinctMoods}    color="pink" />
        <StatCard icon={ArrowRightLeft} label="사용된 팔레트 수"  value={ov.distinctPalettes} color="rose" />
      </div>

      {/* 이벤트 타입별 */}
      <Card title="이벤트 타입 분포">
        {Object.keys(stats.byEvent).length === 0 ? (
          <Empty label="아직 이벤트 타입별 데이터 없음" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Object.entries(stats.byEvent).map(([type, n]) => (
              <div key={type} className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs text-gray-500 uppercase">{type}</p>
                <p className="text-xl font-bold">{n.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 감성별 빈도 */}
      <Card title="감성 키워드 빈도 (top 10)">
        {stats.byMood.length === 0 ? (
          <Empty label="감성 태그 데이터 없음" />
        ) : (
          <div className="space-y-2">
            {stats.byMood.slice(0, 10).map((m) => {
              const max = stats.byMood[0].count;
              const pct = Math.round((m.count / max) * 100);
              return (
                <div key={m.mood} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">{m.mood}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="bg-red-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-12 text-right text-sm text-gray-600">{m.count}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 평균 고민시간 */}
      <Card title="감성별 평균 고민시간 (dwell)" icon={Clock}>
        {stats.avgDwellByEmotion.length === 0 ? (
          <Empty label="dwell 데이터 없음" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">감성</th>
                  <th className="text-right px-3 py-2">샘플 수</th>
                  <th className="text-right px-3 py-2">평균 체류 (sec)</th>
                </tr>
              </thead>
              <tbody>
                {stats.avgDwellByEmotion.slice(0, 15).map((r) => (
                  <tr key={r.mood} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.mood}</td>
                    <td className="px-3 py-2 text-right">{r.n.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{(r.avgMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 팔레트 사용 순위 */}
      <Card title="팔레트 사용 순위">
        {stats.byPalette.length === 0 ? (
          <Empty label="팔레트 데이터 없음" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.byPalette.map((p) => (
              <span key={p.id} className="px-3 py-1.5 bg-rose-50 text-rose-700 text-sm rounded-full border border-rose-200">
                {p.id} <strong className="ml-1">{p.count}</strong>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* 교체 패턴 */}
      <Card title="자재 교체 패턴 (top 10)" icon={ArrowRightLeft}>
        {stats.topSwaps.length === 0 ? (
          <Empty label="아직 교체 이벤트 없음" />
        ) : (
          <div className="space-y-2">
            {stats.topSwaps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="flex-1 flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-100 rounded">{s.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded">{s.to}</span>
                  {s.palette && <span className="text-xs text-gray-400 ml-2">({s.palette})</span>}
                </div>
                <span className="font-mono text-gray-600">×{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 최근 피드백 */}
      <Card title="최근 감정 피드백" icon={MessageSquare}>
        {stats.recentFeedback.length === 0 ? (
          <Empty label="피드백 없음" />
        ) : (
          <div className="space-y-3">
            {stats.recentFeedback.map((f, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <SignalBadge signal={f.emotion_signal} />
                  {f.emotion_score != null && (
                    <span className="font-mono">{f.emotion_score.toFixed(2)}</span>
                  )}
                  <span>{new Date(f.created_at).toLocaleString("ko-KR")}</span>
                </div>
                <p className="text-sm text-gray-800">{f.feedback_text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5 text-gray-600" />}
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 italic py-3">{label}</p>;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "red" | "pink" | "rose";
}) {
  const bg = color === "red" ? "bg-red-50 text-red-600"
           : color === "pink" ? "bg-pink-50 text-pink-600"
           : "bg-rose-50 text-rose-600";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-gray-400">—</span>;
  const cls = signal === "positive" ? "bg-green-100 text-green-700"
            : signal === "negative" ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{signal}</span>;
}
