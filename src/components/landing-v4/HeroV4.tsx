"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

/**
 * Hero V4 — 200vh sticky
 * • flOw wordmark (가운데 O가 거대 hex coin)
 * • 5개 떠다니는 hex coin 패럴랙스
 * • 5개 pillar 카드가 hero 후반부에 radial로 펼쳐짐
 */

const COINS = [
  { size: 180, top: "12%", left: "6%", color: "#FDCBC4", speed: 0.25, rot: 0.08 },
  { size: 130, top: "30%", right: "8%", color: "#FFF6F5", speed: -0.18, rot: -0.12 },
  { size: 220, bottom: "14%", left: "5%", color: "#FF5A42", speed: 0.4, rot: 0.06 },
  { size: 150, bottom: "20%", right: "6%", color: "#FFE5DD", speed: -0.3, rot: -0.1 },
  { size: 110, bottom: "30%", left: "50%", color: "#F5B1A3", speed: 0.15, rot: 0.2 },
];

const PILLARS = [
  { tag: "01", title: "주소", desc: "주소만 입력하면\n면적·평형 자동", bg: "#FFF6F5", color: "#1A0908", target: { x: -32, y: -28 }, rot: -6 },
  { tag: "02", title: "AI 디자인", desc: "8장 무료 시안\n취향 기반", bg: "#FDCBC4", color: "#360802", target: { x: 32, y: -24 }, rot: 4 },
  { tag: "03", title: "AR 확인", desc: "내 방에 그대로\n겹쳐보는 AR", bg: "#1A0908", color: "#FFF6F5", target: { x: -36, y: 10 }, rot: 3 },
  { tag: "04", title: "토큰", desc: "⬢ 5 가입증정\n견적 1회당 ⬢ 1", bg: "#360802", color: "#FDCBC4", target: { x: 34, y: 14 }, rot: -5 },
  { tag: "05", title: "표준계약", desc: "법무 검수 완료\n원-탭 서명", bg: "#7A2739", color: "#FDCBC4", target: { x: 0, y: 30 }, rot: -2 },
];

export default function HeroV4() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section id="hero" ref={ref} className="relative h-[200vh] bg-primary-500">
      <div className="sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden">
        {/* 라디얼 배경 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(253,203,196,0.25), transparent 60%)",
          }}
        />

        {/* 떠다니는 코인 */}
        {COINS.map((c, i) => (
          <FloatingCoin key={i} progress={scrollYProgress} {...c} />
        ))}

        {/* 워드마크 */}
        <Wordmark progress={scrollYProgress} />

        {/* 서브 카피 */}
        <SubCopy progress={scrollYProgress} />

        {/* CTA */}
        <CtaRow progress={scrollYProgress} />

        {/* 5개 pillar 카드 */}
        {PILLARS.map((p, i) => (
          <Pillar key={i} index={i} progress={scrollYProgress} {...p} />
        ))}

        {/* SCROLL 힌트 */}
        <div className="font-mono pointer-events-none absolute bottom-7 left-10 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-offwhite/70">
          <span className="block h-7 w-px bg-offwhite/50" />
          scroll
        </div>
      </div>
    </section>
  );
}

function FloatingCoin({
  progress,
  size,
  color,
  speed,
  rot,
  ...pos
}: {
  progress: MotionValue<number>;
  size: number;
  color: string;
  speed: number;
  rot: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}) {
  const y = useTransform(progress, [0, 1], [0, speed * 600]);
  const r = useTransform(progress, [0, 1], [0, rot * 600]);
  return (
    <motion.div
      style={{ ...pos, y, rotate: r, width: size, height: size }}
      className="pointer-events-none absolute"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <polygon points="25,6.7 75,6.7 100,50 75,93.3 25,93.3 0,50" fill={color} />
      </svg>
    </motion.div>
  );
}

function Wordmark({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  const y = useTransform(progress, [0, 1], [0, -40]);
  const opacity = useTransform(progress, [0, 0.5, 1], [1, 1, 0.18]);
  const oRotate = useTransform(progress, [0, 1], [0, 360]);
  return (
    <motion.div
      style={{ scale, y, opacity }}
      className="font-en pointer-events-none flex items-center justify-center text-offwhite"
    >
      <span
        className="font-black"
        style={{
          fontSize: "clamp(120px, 18vw, 280px)",
          lineHeight: 0.86,
          letterSpacing: "-0.05em",
        }}
      >
        fl
      </span>
      <motion.span
        style={{ rotate: oRotate, width: "0.86em", height: "0.86em", margin: "0 -0.02em", display: "inline-block", fontSize: "clamp(120px, 18vw, 280px)" }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon points="25,6.7 75,6.7 100,50 75,93.3 25,93.3 0,50" fill="#FDCBC4" />
        </svg>
      </motion.span>
      <span
        className="font-black"
        style={{
          fontSize: "clamp(120px, 18vw, 280px)",
          lineHeight: 0.86,
          letterSpacing: "-0.05em",
        }}
      >
        w.
      </span>
    </motion.div>
  );
}

function SubCopy({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.4], [1, 0]);
  const y = useTransform(progress, [0, 1], [0, -60]);
  return (
    <motion.div style={{ opacity, y }} className="mt-7 px-6 text-center">
      <h1
        className="font-kr m-0 text-offwhite"
        style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15 }}
      >
        모든 인테리어 과정, 하나의 흐름으로.
      </h1>
      <p className="mt-2.5 text-base font-medium text-offwhite/[0.78]">
        AI 디자인 · AR 확인 · 표준 단가 견적 · 표준계약까지, 하나의 앱.
      </p>
    </motion.div>
  );
}

function CtaRow({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.4], [1, 0]);
  const y = useTransform(progress, [0, 1], [0, -60]);
  return (
    <motion.div style={{ opacity, y }} className="mt-7 flex gap-3">
      <a
        href="/project/new"
        className="font-kr inline-flex items-center gap-2 rounded-full bg-ink px-[26px] py-4 text-[15px] font-semibold text-offwhite"
      >
        무료 견적 시작 →
      </a>
      <a
        href="#demo"
        className="font-kr inline-flex items-center gap-2 rounded-full border-[1.5px] border-offwhite/50 bg-transparent px-[26px] py-4 text-[15px] font-semibold text-offwhite"
      >
        견적 어떻게 나오는지 보기
      </a>
    </motion.div>
  );
}

function Pillar({
  index,
  progress,
  tag,
  title,
  desc,
  bg,
  color,
  target,
  rot,
}: {
  index: number;
  progress: MotionValue<number>;
  tag: string;
  title: string;
  desc: string;
  bg: string;
  color: string;
  target: { x: number; y: number };
  rot: number;
}) {
  // 진행 0.4 → 0.85 구간에서 카드들이 0,0(중앙) → 목표 위치로 펼쳐짐
  // 각 카드는 i*0.05 만큼 stagger
  const pillarT = useTransform(progress, (p) => {
    const start = 0.4;
    const end = 0.85;
    const local = (p - start) / (end - start) * 1.4 - index * 0.05;
    return Math.max(0, Math.min(1, local));
  });
  const eased = useTransform(pillarT, (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
  // window 사이즈 1280×800 가정 (CSR이면 useEffect로 측정해도 됨, 여기선 vh/vw 픽셀로 변환)
  const x = useTransform(eased, (e) => `calc(${target.x * e}vw - 110px)`);
  const y = useTransform(eased, (e) => `calc(${target.y * e}vh - 90px)`);
  const r = useTransform(eased, (e) => rot * e);
  const scale = useTransform(eased, (e) => 0.6 + 0.4 * e);
  const opacity = eased;

  return (
    <motion.div
      style={{ x, y, rotate: r, scale, opacity, background: bg, color }}
      className="pointer-events-none absolute flex h-[180px] w-[220px] flex-col rounded-[28px] p-[18px]"
    >
      <div
        className="font-mono text-[11px] uppercase tracking-[0.12em]"
        style={{ opacity: 0.7 }}
      >
        {tag}
      </div>
      <div className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em]">{title}</div>
      <div className="font-kr mt-auto whitespace-pre-line text-[13px] leading-[1.45] opacity-85">
        {desc}
      </div>
    </motion.div>
  );
}
