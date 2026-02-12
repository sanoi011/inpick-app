"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface CrawlLog {
  id: string;
  source_name: string;
  status: string;
  records_updated: number;
  started_at: string;
}

export default function AdminCrawlersPage() {
  const { authChecked } = useAdminAuth();
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [crawling, setCrawling] = useState(false);

  useEffect(() => {
    if (authChecked) loadLogs();
  }, [authChecked]);

  async function loadLogs() {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.recentCrawls || []);
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
      await loadLogs();
    } catch { /* ignore */ } finally {
      setCrawling(false);
    }
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">크롤러 관리</h2>
        <button onClick={() => runCrawler("all")} disabled={crawling}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          전체 크롤링 실행
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">소스</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">갱신 건수</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">실행 시간</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">크롤 기록이 없습니다</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{log.source_name}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    log.status === "completed" ? "bg-green-100 text-green-700" :
                    log.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{log.status}</span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500 text-right">{log.records_updated}건</td>
                <td className="px-6 py-3 text-sm text-gray-400 text-right">{new Date(log.started_at).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
