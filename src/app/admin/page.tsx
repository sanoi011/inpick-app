"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Users, RefreshCw, Loader2,
  TrendingUp, Package, FolderKanban, DollarSign, Bot,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

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

  useEffect(() => {
    if (authChecked) loadStats();
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
    } catch { /* ignore */ }
  }

  async function runCrawler(type: string) {
    setCrawling(true);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      await loadStats();
    } catch { /* ignore */ } finally {
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
        <StatCard icon={FolderKanban} label="프로젝트" value={`${stats.projects}건`} color="text-green-600" />
        <StatCard icon={FileText} label="견적/계약" value={`${stats.estimates}건`} color="text-purple-600" />
        <StatCard icon={DollarSign} label="총 크레딧" value={`${stats.totalCredits}`} color="text-orange-600" />
        <StatCard icon={Bot} label="AI 대화" value={`${stats.aiConversations}건`} color="text-pink-600" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users} label="등록 업체" value={`${stats.contractors}개`} color="text-teal-600" />
        <StatCard icon={Package} label="자재 단가" value={`${stats.materials}건`} color="text-indigo-600" />
        <StatCard icon={TrendingUp} label="크롤 로그" value={`${stats.crawlLogs}건`} color="text-amber-600" />
        <StatCard icon={BarChart3} label="활성 계약" value={`${stats.contracts}건`} color="text-red-600" />
      </div>

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
            <Link href="/project/new" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-900">테스트 프로젝트 생성</span>
            </Link>
            <Link href="/contractor" className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-gray-900">사업자 대시보드</span>
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
