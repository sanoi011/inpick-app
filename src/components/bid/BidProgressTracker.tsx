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
 * 견적·입찰·계약 진행 단계 시각화
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
    <div className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
      {/* 상단 — 현재 단계 + 다음 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] px-5 py-4 text-black">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black/40">
            현재 단계
          </p>
          <p className="mt-0.5 text-xl font-extrabold tracking-tight">
            {STAGE_LABEL[currentStage]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] text-black/45">
            {next.actor === "consumer"
              ? "소비자 확인"
              : next.actor === "contractor"
                ? "사업자 진행"
                : "시스템 진행"}
          </p>
          <p className="mt-0.5 text-sm font-semibold max-w-md leading-tight">
            {next.action}
          </p>
          {next.cta && next.href && (
            <a
              href={next.href}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-black/80"
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
                      ? "border-black bg-black text-white"
                      : active
                        ? "border-black bg-black text-white ring-4 ring-black/10"
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
                      ? "text-black"
                      : done
                        ? "text-black/70"
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
                    pending ? "bg-zinc-200" : done ? "bg-black" : "bg-gradient-to-r from-black to-zinc-200"
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
                    ? "border-black bg-black text-white"
                    : active
                      ? "border-black bg-black text-white"
                      : "bg-white border-zinc-300 text-zinc-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Clock className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
              </div>
              <p
                className={`text-sm font-semibold ${
                  active ? "text-black" : done ? "text-black/70" : "text-zinc-400"
                }`}
              >
                {STAGE_LABEL[stage]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 border-t border-black/[0.07] bg-[#f7f7f5] px-5 py-3">
        <AlertCircle className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[0.7rem] text-zinc-600 leading-relaxed">
          입찰은 총액, 포함 공사, 자재, 일정과 보증 조건을 같은 형식으로 비교합니다. 업체 선정 후 계약 단계에서 공정거래위원회 표준계약서 내용을 최종 확인하세요.
        </p>
      </div>
    </div>
  );
}
