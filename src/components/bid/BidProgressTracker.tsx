/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Check,
  Circle,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  type BidStage,
  getNextAction,
} from "@/lib/inpick/bid-pipeline";

/**
 * 견적·입찰·계약 진행 단계 시각화 (나라장터 + 하도급지킴이 패턴)
 * - 가로 stepper (PC) / 세로 timeline (모바일)
 * - 현재 단계 강조 + 완료/대기 구분
 * - 다음 액션 안내 (actor + CTA)
 */
export default function BidProgressTracker({
  currentStage,
  publishedAt,
  deadlineAt,
}: {
  currentStage: BidStage;
  publishedAt?: string;
  deadlineAt?: string;
}) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const next = getNextAction(currentStage);

  return (
    <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
      {/* 상단 — 현재 단계 + 다음 액션 */}
      <div className="px-5 py-4 bg-[#1B3556] text-white flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/70">
            현재 단계
          </p>
          <p className="mt-0.5 text-xl font-extrabold tracking-tight">
            {STAGE_LABEL[currentStage]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] text-white/70">
            {next.actor === "consumer"
              ? "👤 소비자 액션"
              : next.actor === "contractor"
                ? "🏢 사업자 액션"
                : "⚙ 시스템 진행"}
          </p>
          <p className="mt-0.5 text-sm font-semibold max-w-md leading-tight">
            {next.action}
          </p>
          {next.cta && next.href && (
            <a
              href={next.href}
              className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              {next.cta} <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 가로 stepper (PC) */}
      <div className="hidden lg:flex items-stretch px-2 py-4 gap-0">
        {STAGE_ORDER.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const pending = i > currentIdx;
          return (
            <div key={stage} className="flex-1 flex items-start">
              <div className="flex-1 flex flex-col items-center text-center px-1">
                <div
                  className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : active
                        ? "bg-[#1B3556] border-[#1B3556] text-white ring-4 ring-[#1B3556]/20"
                        : "bg-white border-zinc-300 text-zinc-400"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : active ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-xs font-bold tabular">{i + 1}</span>
                  )}
                </div>
                <p
                  className={`mt-2 text-[0.7rem] font-bold leading-tight ${
                    active
                      ? "text-[#1B3556]"
                      : done
                        ? "text-emerald-700"
                        : "text-zinc-400"
                  }`}
                >
                  {STAGE_LABEL[stage]}
                </p>
                {active && (publishedAt || deadlineAt) && (
                  <p className="mt-1 text-[0.6rem] text-zinc-500 tabular">
                    {stage === "rfq_published" && publishedAt && publishedAt.slice(0, 10)}
                    {stage === "bidding_open" && deadlineAt && `마감 ${deadlineAt.slice(0, 10)}`}
                  </p>
                )}
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div
                  className={`mt-4 h-0.5 flex-1 ${
                    pending ? "bg-zinc-200" : done ? "bg-emerald-500" : "bg-gradient-to-r from-[#1B3556] to-zinc-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 세로 timeline (모바일) */}
      <div className="lg:hidden divide-y divide-zinc-100">
        {STAGE_ORDER.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div
              key={stage}
              className={`px-5 py-3 flex items-center gap-3 ${
                active ? "bg-zinc-50" : ""
              }`}
            >
              <div
                className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                  done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : active
                      ? "bg-[#1B3556] border-[#1B3556] text-white"
                      : "bg-white border-zinc-300 text-zinc-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Clock className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
              </div>
              <p
                className={`text-sm font-semibold ${
                  active ? "text-[#1B3556]" : done ? "text-emerald-700" : "text-zinc-400"
                }`}
              >
                {STAGE_LABEL[stage]}
              </p>
            </div>
          );
        })}
      </div>

      {/* 정부기관 표준 안내 */}
      <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[0.7rem] text-zinc-600 leading-relaxed">
          본 프로세스는 <b>국토교통부 실내건축 표준계약서</b> + <b>하도급지킴이 대금지급보증</b> + <b>건설산업기본법</b>을
          기준으로 설계되었습니다. 각 단계는 InPick 플랫폼이 자동 검증·기록하며, 분쟁 시 한국공정거래조정원 → 건설분쟁조정위 절차를 따릅니다.
        </p>
      </div>
    </div>
  );
}
