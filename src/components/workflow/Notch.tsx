"use client";

import { motion } from "motion/react";

interface Props {
  step: number;
  total: number;
}

export default function Notch({ step, total }: Props) {
  const labels = ["공간 정보", "AI 디자인", "견적 확인"];

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2">
      <div className="flex items-center rounded-full border border-black/[0.08] bg-white/95 p-1 shadow-sm backdrop-blur-xl">
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1;
          const active = number === step;
          const complete = number < step;
          return (
            <div key={number} className="flex items-center">
              <div
                className={`flex h-8 items-center gap-1.5 rounded-full px-1.5 transition-colors sm:px-2.5 ${
                  active ? "bg-black text-white" : "text-black/40"
                }`}
              >
                <motion.span
                  animate={active ? { scale: [1, 1.08, 1] } : undefined}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-white text-black"
                      : complete
                        ? "bg-black text-white"
                        : "bg-black/[0.05] text-black/45"
                  }`}
                >
                  {number}
                </motion.span>
                <span className="hidden whitespace-nowrap text-[10px] font-semibold sm:inline">
                  {labels[index] || `STEP ${number}`}
                </span>
              </div>
              {number < total && <span className="mx-0.5 h-px w-2 bg-black/10 sm:w-3" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
