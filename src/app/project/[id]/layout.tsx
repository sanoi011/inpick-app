"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Package, Calculator, FileText, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjectState } from "@/hooks/useProjectState";
import { SaveButton } from "@/components/ui/SaveIndicator";
import type { ConsumerProjectStatus } from "@/types/consumer-project";
import { isStatusAtLeast } from "@/types/consumer-project";

const TABS = [
  { label: "디자인하기", segment: "design", icon: Box },
  { label: "자재 선택", segment: "rendering", icon: Package },
  { label: "물량산출", segment: "estimate", icon: Calculator },
  { label: "견적요청", segment: "rfq", icon: FileText },
];

const STATUS_TO_STEP: Record<ConsumerProjectStatus, number> = {
  ADDRESS_SELECTION: 1,
  FLOOR_PLAN: 1,
  AI_DESIGN: 2,
  RENDERING: 2,
  ESTIMATING: 3,
  RFQ: 4,
  CONTRACTED: 5,
};

const TAB_MIN_STATUS: Record<string, ConsumerProjectStatus> = {
  design: "ADDRESS_SELECTION",
  rendering: "RENDERING",
  estimate: "ESTIMATING",
  rfq: "RFQ",
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.id as string;
  const { project, saveStatus, forceSave } = useProjectState(projectId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?returnUrl=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, router, pathname]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">로그인 확인 중...</p>
        </div>
      </div>
    );
  }

  const currentStep = project ? STATUS_TO_STEP[project.status] ?? 1 : 1;
  const projectStatus = project?.status ?? "ADDRESS_SELECTION";

  const isActive = (segment: string) => {
    return pathname.endsWith(`/${segment}`);
  };

  const canNavigateTab = (segment: string) => {
    return isStatusAtLeast(projectStatus, TAB_MIN_STATUS[segment]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/projects" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link href="/" className="text-xl font-bold text-blue-600">
                INPICK
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab, idx) => {
                const active = isActive(tab.segment);
                const stepNum = idx + 1;
                const isCompleted = stepNum < currentStep;
                const href = `/project/${projectId}/${tab.segment}`;
                const unlocked = canNavigateTab(tab.segment);

                if (!unlocked) {
                  return (
                    <span
                      key={tab.segment}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium opacity-40 cursor-not-allowed select-none"
                      title="이전 단계를 완료해주세요"
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-gray-400">
                        <Lock className="w-3 h-3" />
                      </span>
                      <tab.icon className="w-4 h-4 text-gray-300" />
                      <span className="hidden md:inline text-gray-400">{tab.label}</span>
                    </span>
                  );
                }

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
                      ${isCompleted
                        ? "bg-green-500 text-white"
                        : active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-500"
                      }
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        stepNum
                      )}
                    </span>
                    <tab.icon className={`w-4 h-4 ${
                      isCompleted ? "text-green-500" : active ? "text-blue-600" : "text-gray-400"
                    }`} />
                    <span className="hidden md:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>

            <SaveButton status={saveStatus} onClick={forceSave} />
          </div>

          {/* 모바일 탭 */}
          <nav className="md:hidden flex items-center gap-1.5 pb-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            {TABS.map((tab, idx) => {
              const active = isActive(tab.segment);
              const stepNum = idx + 1;
              const isCompleted = stepNum < currentStep;
              const unlocked = canNavigateTab(tab.segment);

              if (!unlocked) {
                return (
                  <span
                    key={tab.segment}
                    className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap opacity-40 cursor-not-allowed select-none border border-gray-200 snap-start"
                  >
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-200 text-gray-400">
                      <Lock className="w-3 h-3" />
                    </span>
                    {tab.label}
                  </span>
                );
              }

              const href = `/project/${projectId}/${tab.segment}`;
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={`
                    flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-colors snap-start
                    ${active
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-500 border border-gray-200"
                    }
                  `}
                >
                  <span className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${isCompleted
                      ? "bg-green-500 text-white"
                      : active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      stepNum
                    )}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
