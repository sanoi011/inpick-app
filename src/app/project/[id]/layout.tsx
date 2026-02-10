"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Palette, Calculator, FileText, Save, ArrowLeft } from "lucide-react";

const TABS = [
  { label: "우리집 찾기", segment: "home", icon: Home },
  { label: "디자인하기", segment: "design", icon: Palette },
  { label: "견적산출", segment: "estimate", icon: Calculator },
  { label: "견적받기", segment: "bids", icon: FileText },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;

  const isActive = (segment: string) => {
    return pathname.endsWith(`/${segment}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 상단 네비게이션 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* 좌: 로고 + 뒤로가기 */}
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link href="/" className="text-xl font-bold text-blue-600">
                INPICK
              </Link>
            </div>

            {/* 중앙: 4탭 */}
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab, idx) => {
                const active = isActive(tab.segment);
                const href = `/project/${projectId}/${tab.segment}`;
                return (
                  <Link
                    key={tab.segment}
                    href={href}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${active
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }
                    `}
                  >
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}
                    `}>
                      {idx + 1}
                    </span>
                    <tab.icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-gray-400"}`} />
                    <span className="hidden lg:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* 우: 저장 버튼 */}
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">저장하기</span>
            </button>
          </div>

          {/* 모바일 탭 */}
          <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
            {TABS.map((tab, idx) => {
              const active = isActive(tab.segment);
              const href = `/project/${projectId}/${tab.segment}`;
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                    ${active
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-500 border border-gray-200"
                    }
                  `}
                >
                  <span className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}
                  `}>
                    {idx + 1}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 페이지 콘텐츠 */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
