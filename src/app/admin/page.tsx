"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Users, RefreshCw, Loader2,
  TrendingUp, Package, FolderKanban, Hexagon, Bot,
  MapPin, Building2, Database, ImageIcon, Sparkles,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/components/ui/Toast";

interface Stats {
  estimates: number;
  contractors: number;
  materials: number;
  crawlLogs: number;
  consumers: number;
  projects: number;
  contracts: number;
  totalCredits: number;
  aiConversations: number;
}

interface CrawlLog {
  id: string;
  source_name: string;
  status: string;
  records_updated: number;
  started_at: string;
}

interface CoverageData {
  totalRegions: number;
  totalComplexes: number;
  totalHouseholds: number;
  coveragePercent: number;
  sidoStats: { name: string; regions: number; complexes: number; households: number }[];
  regions: { cortarNo: string; complexCount: number; householdCount: number; fetchedAt: string; address: string }[];
}

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

export default function AdminDashboardPage() {
  const { authChecked } = useAdminAuth();
  const [stats, setStats] = useState<Stats>({
    estimates: 0, contractors: 0, materials: 0, crawlLogs: 0,
    consumers: 0, projects: 0, contracts: 0, totalCredits: 0, aiConversations: 0,
  });
  const [recentCrawls, setRecentCrawls] = useState<CrawlLog[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);

  useEffect(() => {
    if (authChecked) {
      loadStats();
      loadCoverage();
    }
  }, [authChecked]);

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
    } catch { toast({ type: "error", title: "오류", message: "통계를 불러올 수 없습니다" }); }
  }

  async function loadCoverage() {
    try {
      const res = await fetch("/api/admin/coverage");
      if (res.ok) setCoverage(await res.json());
    } catch { toast({ type: "error", title: "오류", message: "커버리지를 불러올 수 없습니다" }); }
  }

  async function runCrawler(type: string) {
    setCrawling(true);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
        body: JSON.stringify({ type }),
      });
      await loadStats();
    } catch { toast({ type: "error", title: "오류", message: "크롤러 실행에 실패했습니다" }); } finally {
      setCrawling(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">대시보드 개요</h2>

      {/* 주요 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="소비자" value={`${stats.consumers}명`} color="text-blue-600" />
        <StatCard icon={FolderKanban} label="진행 프로젝트" value={`${stats.projects}건`} color="text-green-600" />
        <StatCard icon={FileText} label="견적·계약" value={`${stats.estimates}건`} color="text-purple-600" />
        <StatCard icon={Hexagon} label="총 보유 토큰" value={`${stats.totalCredits.toLocaleString()}`} color="text-amber-600" />
        <StatCard icon={Bot} label="AI 호출 누적" value={`${stats.aiConversations}건`} color="text-pink-600" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users} label="등록 업체" value={`${stats.contractors}개`} color="text-teal-600" />
        <StatCard icon={Package} label="자재 단가 DB" value={`${stats.materials}건`} color="text-indigo-600" />
        <StatCard icon={TrendingUp} label="크롤 로그" value={`${stats.crawlLogs}건`} color="text-amber-600" />
        <StatCard icon={BarChart3} label="활성 계약" value={`${stats.contracts}건`} color="text-red-600" />
      </div>

      {/* AI 시스템 현황 — 현재 사용 중인 모델·엔드포인트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          AI 시스템 현황 (2026-05)
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p className="font-bold text-amber-700">이미지 생성</p>
            <p className="text-amber-900/80 mt-1">gpt-image-2 단일 (폴백 없음 · 실패 시 토큰 차감 X)</p>
            <p className="text-amber-700/60 mt-1 tabular">/api/inpick/render-room</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="font-bold text-blue-700">Vision 분석</p>
            <p className="text-blue-900/80 mt-1">GPT-4o (정형화 + 자재 영역)</p>
            <p className="text-blue-700/60 mt-1 tabular">normalize-floorplan / extract-regions</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
            <p className="font-bold text-purple-700">고화질 재렌더</p>
            <p className="text-purple-900/80 mt-1">gpt-image-2 inpaint (마스크 기반 · 폴백 없음)</p>
            <p className="text-purple-700/60 mt-1 tabular">/api/inpick/refine-render</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <p className="font-bold text-emerald-700">견적 산출</p>
            <p className="text-emerald-900/80 mt-1">Vision 자재 추출 + MOLIT 일위대가 + 부자재 10%</p>
            <p className="text-emerald-700/60 mt-1 tabular">/api/inpick/build-estimate</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>1차 미리보기 무료 → 자재 분석 1토큰 → 고화질 재렌더 2토큰 (사용자 명시)</span>
        </div>
      </div>

      {/* 데이터 커버리지 */}
      {coverage && coverage.totalComplexes > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              아파트 데이터 커버리지
            </h3>
            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
              {coverage.coveragePercent}% 전국
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <MapPin className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{coverage.totalRegions}</p>
              <p className="text-xs text-gray-500">수집 지역</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <Building2 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{coverage.totalComplexes.toLocaleString()}</p>
              <p className="text-xs text-gray-500">아파트 단지</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <Users className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">
                {coverage.totalHouseholds >= 10000
                  ? `${(coverage.totalHouseholds / 10000).toFixed(1)}만`
                  : coverage.totalHouseholds.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">총 세대수</p>
            </div>
          </div>

          {/* 시도별 바 */}
          {coverage.sidoStats.length > 0 && (
            <div className="space-y-1.5">
              {coverage.sidoStats.slice(0, 8).map((sido) => {
                const maxC = coverage.sidoStats[0].complexes || 1;
                return (
                  <div key={sido.name} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-16 text-right text-xs flex-shrink-0">
                      {sido.name.replace(/(특별|광역)(시|자치시|자치도)/, "").replace("도", "")}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full flex items-center justify-end px-2"
                        style={{ width: `${Math.max(10, (sido.complexes / maxC) * 100)}%` }}
                      >
                        <span className="text-xs text-white font-medium">{sido.complexes}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 커버리지 프로그레스 바 */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>전국 커버리지</span>
              <span>{coverage.totalComplexes.toLocaleString()} / ~20,000 단지</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.max(1, coverage.coveragePercent)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 빠른 작업 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">빠른 작업</h3>
          <div className="space-y-2">
            <button onClick={() => runCrawler("all")} disabled={crawling}
              className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-left disabled:opacity-50">
              {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-blue-600" />}
              <span className="font-medium text-gray-900">전체 단가 갱신</span>
              <span className="text-gray-400 ml-auto">3대 기관 크롤링</span>
            </button>
            <Link href="/admin/materials" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <Package className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-gray-900">자재 단가 직접 편집</span>
              <span className="text-gray-400 ml-auto">인라인 게시판</span>
            </Link>
            <Link href="/admin/credits" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <Hexagon className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-gray-900">사용자 토큰 충전·환급</span>
            </Link>
            <Link href="/admin/drawing-logs" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <Bot className="w-4 h-4 text-pink-600" />
              <span className="font-medium text-gray-900">도면 인식 로그 (GPT-4o Vision)</span>
            </Link>
            <Link href="/contractor" target="_blank" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-gray-900">사업자 대시보드 (새 탭)</span>
            </Link>
          </div>
        </div>

        {/* 최근 크롤 로그 */}
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
  );
}
