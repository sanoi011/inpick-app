"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, DollarSign, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function AdminMaterialsPage() {
  const { authChecked } = useAdminAuth();
  const [crawling, setCrawling] = useState<string | null>(null);

  async function runCrawler(type: string) {
    setCrawling(type);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
    } catch { /* ignore */ } finally {
      setCrawling(null);
    }
  }

  if (!authChecked) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">자재 / 단가 관리</h2>

      {/* 단가 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <Package className="w-8 h-8 text-blue-600 mb-3" />
          <p className="font-semibold text-gray-900">자재 단가</p>
          <p className="text-sm text-gray-500 mt-1">한국물가협회 | 매월 갱신</p>
          <button onClick={() => runCrawler("material")} disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
            {crawling === "material" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <DollarSign className="w-8 h-8 text-green-600 mb-3" />
          <p className="font-semibold text-gray-900">노임 단가</p>
          <p className="text-sm text-gray-500 mt-1">대한건설협회 | 반기별 갱신</p>
          <button onClick={() => runCrawler("labor")} disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
            {crawling === "labor" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
          <p className="font-semibold text-gray-900">간접비율</p>
          <p className="text-sm text-gray-500 mt-1">조달청 | 연간 갱신</p>
          <button onClick={() => runCrawler("overhead")} disabled={!!crawling}
            className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50">
            {crawling === "overhead" ? "갱신 중..." : "수동 갱신"}
          </button>
        </div>
      </div>

      {/* 자재 카탈로그 링크 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2">자재 카탈로그 DB</h3>
        <p className="text-sm text-gray-500 mb-3">
          방 타입별 자재 카테고리 → 옵션 → 부자재 구조. 렌더링 페이지에서 사용됩니다.
        </p>
        <div className="flex gap-3">
          <Link href="/api/materials" target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            <Package className="w-4 h-4" /> API 확인 (전체)
          </Link>
          <Link href="/api/materials?roomType=LIVING" target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            거실 자재
          </Link>
          <Link href="/api/materials?roomType=BATHROOM" target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            욕실 자재
          </Link>
        </div>
      </div>

      {/* 전체 크롤링 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">전체 단가 갱신</h3>
          <button onClick={() => runCrawler("all")} disabled={!!crawling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {crawling === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            전체 크롤링 실행
          </button>
        </div>
        <p className="text-sm text-gray-500">
          자재 단가(한국물가협회) + 노임 단가(대한건설협회) + 간접비율(조달청)을 한 번에 갱신합니다.
          크롤러 실행 결과는 대시보드와 크롤러 페이지에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
