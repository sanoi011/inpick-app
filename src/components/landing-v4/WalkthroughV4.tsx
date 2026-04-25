"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

/**
 * Walkthrough V4 — 300vh sticky (시안 정확 재현)
 * • 흰 배경 + 거대 오렌지 글자 "simple, fast & safe."
 * • 5개 카드: photo1 / currency / exchange / contact / photo2
 * • 3 phase: 0~0.35 진입(offscreen→converge), 0.35~0.65 expand(home), 0.65~1 exit(drift down + fade)
 * • 하단 stepper: SIMPLE / FAST / SAFE
 */

interface CardOffsets {
  start: { x: number; y: number; r: number };
  converge: { x: number; y: number; r: number };
  exit: { x: number; y: number; r: number };
}

const OFFSETS: CardOffsets[] = [
  { start: { x: -400, y: -200, r: -25 }, converge: { x: -120, y: -60, r: -8 }, exit: { x: -60, y: 500, r: -30 } },
  { start: { x: 500, y: -250, r: 20 }, converge: { x: 140, y: -70, r: 6 }, exit: { x: 80, y: 600, r: 35 } },
  { start: { x: -350, y: 250, r: -15 }, converge: { x: -130, y: 60, r: -5 }, exit: { x: -40, y: 550, r: -25 } },
  { start: { x: 0, y: 400, r: 10 }, converge: { x: 0, y: 120, r: 3 }, exit: { x: 20, y: 650, r: 20 } },
  { start: { x: 450, y: 220, r: 18 }, converge: { x: 150, y: 50, r: 6 }, exit: { x: 60, y: 580, r: 30 } },
];

export default function WalkthroughV4() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section id="walkthrough" ref={ref} className="relative h-[300vh] bg-offwhite">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* 상단 라벨 */}
        <div className="font-mono absolute left-1/2 top-[90px] -translate-x-1/2 text-[12px] uppercase tracking-[0.2em] text-primary-500">
          ◇ SIMPLE · FAST · SAFE
        </div>

        {/* 떠다니는 카드 5개 */}
        <CardLayer progress={scrollYProgress} idx={0}>
          <PhotoCard1 />
        </CardLayer>
        <CardLayer progress={scrollYProgress} idx={1}>
          <CurrencyCard />
        </CardLayer>
        <CardLayer progress={scrollYProgress} idx={2}>
          <ExchangeCard />
        </CardLayer>
        <CardLayer progress={scrollYProgress} idx={3}>
          <ContactCard />
        </CardLayer>
        <CardLayer progress={scrollYProgress} idx={4}>
          <PhotoCard2 />
        </CardLayer>

        {/* 거대 오렌지 글자 */}
        <BigTitle progress={scrollYProgress} />

        {/* 하단 스텝퍼 */}
        <Stepper progress={scrollYProgress} />
      </div>
    </section>
  );
}

function CardLayer({
  progress,
  idx,
  children,
}: {
  progress: MotionValue<number>;
  idx: number;
  children: React.ReactNode;
}) {
  const offsets = OFFSETS[idx];
  // x, y, rotate, opacity, scale
  const tx = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) {
      const t = ease(p / 0.35);
      return offsets.start.x + (offsets.converge.x - offsets.start.x) * t;
    }
    if (p < 0.65) {
      const t = ease((p - 0.35) / 0.3);
      return offsets.converge.x + (0 - offsets.converge.x) * t;
    }
    const t = ease((p - 0.65) / 0.35);
    return 0 + (offsets.exit.x - 0) * t;
  });
  const ty = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) {
      const t = ease(p / 0.35);
      return offsets.start.y + (offsets.converge.y - offsets.start.y) * t;
    }
    if (p < 0.65) {
      const t = ease((p - 0.35) / 0.3);
      return offsets.converge.y + (0 - offsets.converge.y) * t;
    }
    const t = ease((p - 0.65) / 0.35);
    return 0 + (offsets.exit.y - 0) * t;
  });
  const rotate = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) {
      const t = ease(p / 0.35);
      return offsets.start.r + (offsets.converge.r - offsets.start.r) * t;
    }
    if (p < 0.65) {
      const t = ease((p - 0.35) / 0.3);
      return offsets.converge.r + (0 - offsets.converge.r) * t;
    }
    const t = ease((p - 0.65) / 0.35);
    return 0 + (offsets.exit.r - 0) * t;
  });
  const opacity = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) return ease(p / 0.35);
    if (p < 0.65) return 1;
    const t = ease((p - 0.65) / 0.35);
    return 1 - t;
  });
  const scale = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) {
      const t = ease(p / 0.35);
      return 0.6 + 0.25 * t;
    }
    if (p < 0.65) {
      const t = ease((p - 0.35) / 0.3);
      return 0.85 + 0.15 * t;
    }
    const t = ease((p - 0.65) / 0.35);
    return 1 - 0.15 * t;
  });

  return (
    <motion.div
      style={{ x: tx, y: ty, rotate, opacity, scale }}
      className="absolute will-change-transform"
    >
      {children}
    </motion.div>
  );
}

function BigTitle({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) return 0.85 + ease(p / 0.35) * 0.15;
    if (p < 0.65) return 1.0 + ease((p - 0.35) / 0.3) * 0.08;
    return 1.08 - ease((p - 0.65) / 0.35) * 0.16;
  });
  const y = useTransform(progress, (p) => {
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    if (p < 0.35) return 40 - ease(p / 0.35) * 40;
    if (p < 0.65) return 0;
    return -ease((p - 0.65) / 0.35) * 60;
  });
  const opacity = useTransform(progress, (p) => {
    if (p < 0.35) return p / 0.35;
    if (p < 0.65) return 1;
    return 1 - ((p - 0.65) / 0.35) * 0.6;
  });
  return (
    <motion.h2
      style={{ scale, y, opacity }}
      className="relative z-[5] m-0 text-center font-black text-primary-500"
      data-style={{
        fontSize: "clamp(72px, 13vw, 200px)",
        lineHeight: 0.92,
        letterSpacing: "-0.05em",
      }}
    >
      <span style={{ fontSize: "clamp(72px, 13vw, 200px)", lineHeight: 0.92, letterSpacing: "-0.05em", display: "inline-block" }}>
        simple,&nbsp;
        <span className="font-en italic">fast</span>
        <br />
        &amp;&nbsp;<span className="font-en italic">safe.</span>
      </span>
    </motion.h2>
  );
}

function Stepper({ progress }: { progress: MotionValue<number> }) {
  const items = ["SIMPLE", "FAST", "SAFE"];
  return (
    <div className="absolute inset-x-0 bottom-[50px] z-[6] flex items-center justify-center gap-7">
      {items.map((label, i) => (
        <StepItem key={label} label={label} index={i} progress={progress} />
      ))}
    </div>
  );
}

function StepItem({
  label,
  index,
  progress,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const phaseIdx = useTransform(progress, (p) => (p < 0.35 ? 0 : p < 0.65 ? 1 : 2));
  const opacity = useTransform(phaseIdx, (n) => (n === index ? 1 : n > index ? 0.6 : 0.4));
  const width = useTransform(phaseIdx, (n) => (n === index ? 40 : 8));
  const bg = useTransform(phaseIdx, (n) => (n === index ? "#F73B20" : "rgba(247,59,32,0.25)"));
  return (
    <motion.div style={{ opacity }} className="flex items-center gap-2.5 transition-opacity">
      <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-primary-500">
        {label}
      </span>
      <motion.div style={{ width, background: bg }} className="h-1 rounded-[2px]" />
    </motion.div>
  );
}

/* ── Card visuals ─────────────────────── */

function PhotoCard1() {
  return (
    <div
      className="relative h-[180px] w-[240px] overflow-hidden rounded-[22px]"
      style={{
        background:
          "radial-gradient(circle at 30% 25%, #F8C9A8 0%, transparent 45%), linear-gradient(135deg, #E8A57A 0%, #B86A3E 100%)",
        boxShadow: "0 24px 50px -18px rgba(54,8,2,0.18)",
      }}
    >
      <div
        className="absolute"
        style={{
          left: "18%",
          top: "28%",
          width: "38%",
          height: "44%",
          background: "linear-gradient(180deg, #2A1A12 0%, #4A2A1A 100%)",
          borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          boxShadow: "inset -8px -6px 0 rgba(0,0,0,0.18)",
        }}
      />
      <div
        className="absolute"
        style={{
          right: "12%",
          top: "14%",
          width: "32%",
          height: "28%",
          background: "#4A3020",
          borderRadius: "6px",
          boxShadow: "0 6px 0 -2px #2A1A0E",
        }}
      />
    </div>
  );
}

function CurrencyCard() {
  return (
    <div
      className="relative h-[200px] w-[280px] rounded-[28px] border-[4px] border-[#3B82E5] bg-white p-[22px]"
      style={{ boxShadow: "0 24px 50px -18px rgba(59,130,229,0.3)" }}
    >
      <div className="font-mono inline-flex items-center gap-1.5 rounded-full bg-[#F5F0E8] px-3 py-1.5 text-[11px] text-ink">
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{ background: "radial-gradient(circle at 30% 30%, #5B9CFF, #1E5BC8)" }}
        />
        KRW ▾
      </div>
      <div className="font-en mt-3 text-[30px] font-extrabold tracking-[-0.02em] text-ink">
        <span className="text-primary-500">₩</span>3,820,000
      </div>
      <div className="font-mono mt-1 text-[11px] text-ink-60">잔여 예산: ₩12,180,000</div>
      <div className="font-mono mt-4 w-full rounded-full bg-ink py-2.5 text-center text-[12px] tracking-[0.08em] text-offwhite">
        결제하기
      </div>
    </div>
  );
}

function ExchangeCard() {
  return (
    <div
      className="relative h-[200px] w-[200px] rounded-[28px] p-[22px] text-white"
      style={{
        background: "linear-gradient(160deg, #3FBA6F 0%, #1F8E4A 100%)",
        boxShadow: "0 24px 50px -18px rgba(31,142,74,0.4)",
      }}
    >
      <div className="font-mono inline-flex items-center gap-1.5 text-[10px] tracking-[0.08em] opacity-85">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px]">⇄</span>
        정산
      </div>
      <div className="font-en mt-3.5 text-[22px] font-extrabold tracking-[-0.01em]">
        − ₩500,000
      </div>
      <div className="font-en text-[22px] font-extrabold tracking-[-0.01em]">+ ₩2,179,920</div>
      <div className="font-mono mt-5 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] tracking-[0.08em]">
        정산완료
      </div>
    </div>
  );
}

function ContactCard() {
  return (
    <div
      className="relative h-[180px] w-[240px] rounded-[28px] p-5 text-ink"
      style={{
        background: "linear-gradient(160deg, #FFD4E2 0%, #F5A8C4 100%)",
        boxShadow: "0 24px 50px -18px rgba(245,168,196,0.5)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-full border-2 border-white"
          style={{ background: "radial-gradient(circle at 30% 30%, #FFE4D6, #C88A6E)" }}
        />
        <div className="text-[14px] font-bold tracking-[-0.01em]">김하나 시공사</div>
      </div>
      <div className="font-mono mt-3.5 flex items-center gap-1.5 text-[11px] text-ink-60">
        🔒 안전 결제
      </div>
      <div className="font-mono mt-3 w-full rounded-full bg-white py-2.5 text-center text-[12px] tracking-[0.08em] text-ink">
        계약금 송금
      </div>
    </div>
  );
}

function PhotoCard2() {
  return (
    <div
      className="relative h-[180px] w-[220px] overflow-hidden rounded-[22px]"
      style={{
        background:
          "radial-gradient(circle at 60% 40%, #C97A4A 0%, transparent 50%), linear-gradient(135deg, #6E3A20 0%, #3A1F12 100%)",
        boxShadow: "0 24px 50px -18px rgba(54,8,2,0.18)",
      }}
    >
      <div
        className="absolute"
        style={{
          left: "8%",
          bottom: "16%",
          width: "36%",
          height: "56%",
          background: "#2A1A0E",
          borderRadius: "50% 50% 30% 30% / 40% 40% 30% 30%",
        }}
      />
      <div
        className="absolute"
        style={{
          right: "14%",
          bottom: "14%",
          width: "32%",
          height: "50%",
          background: "#1A0E08",
          borderRadius: "50% 50% 30% 30% / 40% 40% 30% 30%",
        }}
      />
      <div
        className="font-mono absolute z-[2] rounded-lg bg-white px-3 py-1.5 text-[10px] tracking-[0.06em] text-ink"
        style={{ top: "16%", left: "14%" }}
      >
        시공 완료!
      </div>
    </div>
  );
}
