"use client";

import Link from "next/link";
import { BarChart3, FileText, Users, Bot, Calendar } from "lucide-react";

const MENU_ITEMS = [
  { label: "입찰 관리", href: "/contractor/bids", icon: FileText, description: "새 입찰 참여 및 관리" },
  { label: "AI 비서", href: "/contractor/ai", icon: Bot, description: "AI 기반 분석 및 알림" },
  { label: "전문업체 매칭", href: "#", icon: Users, description: "공종별 전문업체 협업" },
  { label: "일정 관리", href: "#", icon: Calendar, description: "프로젝트 일정 및 스케줄" },
];

export default function ContractorDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">사업자 대시보드</span>
          </div>
          <Link href="/auth" className="text-sm text-gray-500 hover:text-gray-700">로그인</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-500 mb-8">프로젝트와 입찰을 한눈에 관리하세요</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <span className="text-xs text-gray-400">이번 달</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">0건</p>
            <p className="text-sm text-gray-500">진행 중인 프로젝트</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-indigo-600" />
              <span className="text-xs text-gray-400">신규</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">0건</p>
            <p className="text-sm text-gray-500">대기 중인 입찰</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-green-600" />
              <span className="text-xs text-gray-400">총계</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">0건</p>
            <p className="text-sm text-gray-500">완료 프로젝트</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">⭐</span>
              <span className="text-xs text-gray-400">평균</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-500">고객 평점</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MENU_ITEMS.map((item) => (
            <Link key={item.label} href={item.href}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4">
              <item.icon className="w-10 h-10 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">{item.label}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
