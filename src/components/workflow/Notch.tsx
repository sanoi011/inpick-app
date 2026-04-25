"use client";

import { motion } from "motion/react";

interface Props {
  step: number;
  total: number;
}

export default function Notch({ step, total }: Props) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2">
      <div
        className="relative flex h-7 items-center gap-2 rounded-b-[18px] bg-neutral-800 px-5 text-[0.7rem] font-medium tracking-wider text-white/80"
      >
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="h-1.5 w-1.5 rounded-full bg-primary-400"
        />
        <span className="tabular">
          STEP {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        {/* 좌우 외부 곡선 컷아웃 */}
        <span
          className="absolute -left-2.5 top-0 h-2.5 w-2.5 bg-neutral-800"
          style={{ maskImage: "radial-gradient(circle at 0 100%, transparent 10px, #000 10px)", WebkitMaskImage: "radial-gradient(circle at 0 100%, transparent 10px, #000 10px)" }}
        />
        <span
          className="absolute -right-2.5 top-0 h-2.5 w-2.5 bg-neutral-800"
          style={{ maskImage: "radial-gradient(circle at 100% 100%, transparent 10px, #000 10px)", WebkitMaskImage: "radial-gradient(circle at 100% 100%, transparent 10px, #000 10px)" }}
        />
      </div>
    </div>
  );
}
