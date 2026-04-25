"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

const REVIEWS = [
  {
    quote: "8장 시안 중 3장이 마음에 들었어요. 견적 차이가 시공사마다 800만원이었는데 InPick은 일관됐습니다.",
    name: "이수진",
    desc: "강남 신혼 32평",
    avatar: "L",
  },
  {
    quote: "AR로 침대를 미리 놓아본 게 결정타. 실제 살아보니 동선이 그대로였어요.",
    name: "박재훈",
    desc: "유성구 자취 18평",
    avatar: "P",
  },
  {
    quote: "표준계약서가 있어서 시공사와 분쟁이 줄었습니다. 견적 단가도 신뢰가 갔고요.",
    name: "한미라",
    desc: "수원 4인 가족 34평",
    avatar: "H",
  },
  {
    quote: "AI 디자인 8장이 진짜 다 달랐어요. 시공 견적은 평균 -12% 절감했습니다.",
    name: "김도영",
    desc: "서초 단독 45평",
    avatar: "K",
  },
  {
    quote: "주말에 30분이면 끝. 평일에 다른 일을 못 미뤘으니 이게 진짜 차이입니다.",
    name: "윤채영",
    desc: "송파 23평",
    avatar: "Y",
  },
];

const STATS = [
  { v: "1,000+", l: "누적 견적 건수" },
  { v: "98.2%", l: "주소 인식률" },
  { v: "17K", l: "표준 단가 항목" },
  { v: "⬢ 5", l: "가입 증정 토큰" },
];

export default function TestimonialsV4() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section id="test" ref={ref} className="relative h-[500vh] bg-primary-500 text-offwhite">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-10">
        <div className="absolute inset-x-10 top-[100px]">
          <div className="font-mono mb-3.5 text-[12px] tracking-[0.16em] text-apricot-300">
            ◇ FROM REAL USERS
          </div>
          <h2
            className="m-0 max-w-[900px] font-extrabold leading-[0.98] tracking-tightest"
            style={{ fontSize: "clamp(40px, 6vw, 80px)" }}
          >
            시공사 견적과는
            <br />
            다른 경험이었습니다.
          </h2>
        </div>

        <div className="relative mt-10 h-[360px] w-full max-w-[600px]">
          {REVIEWS.map((r, i) => (
            <ReviewCard key={i} index={i} progress={scrollYProgress} review={r} />
          ))}
        </div>

        <div className="absolute inset-x-10 bottom-[60px] grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.l}
              className="rounded-3xl border border-white/[0.18] bg-white/10 p-[22px] backdrop-blur-2xl"
            >
              <div className="font-en text-[36px] font-extrabold leading-none tracking-tightest">
                {s.v}
              </div>
              <div className="mt-2 text-[12px] font-medium opacity-85">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({
  index,
  progress,
  review,
}: {
  index: number;
  progress: MotionValue<number>;
  review: (typeof REVIEWS)[number];
}) {
  const total = REVIEWS.length;
  // 각 카드 local progress
  // testActive = progress * 5; local = testActive - i
  const ty = useTransform(progress, (p) => {
    const local = p * total - index;
    if (local < -1) return 80;
    if (local < 0) return 40 - 40 * (local + 1); // 40 → 0
    if (local < 0.85) return 0;
    if (local < 1.0) {
      const t = (local - 0.85) / 0.15;
      return -120 * t;
    }
    return -120;
  });
  const scale = useTransform(progress, (p) => {
    const local = p * total - index;
    if (local < -1) return 0.85;
    if (local < 0) return 0.9 + 0.1 * (local + 1); // 0.9 → 1
    if (local < 0.85) return 1;
    if (local < 1.0) {
      const t = (local - 0.85) / 0.15;
      return 1 - 0.1 * t;
    }
    return 0.9;
  });
  const opacity = useTransform(progress, (p) => {
    const local = p * total - index;
    if (local < -1) return 0;
    if (local < 0) return 0.5 + 0.5 * (local + 1);
    if (local < 0.85) return 1;
    if (local < 1.0) return 1 - (local - 0.85) / 0.15;
    return 0;
  });
  const zIdx = useTransform(progress, (p) => {
    const local = p * total - index;
    if (local < -1) return 0;
    if (local < 0) return Math.floor((local + 1) * 10);
    if (local < 0.85) return 20 + (total - index);
    if (local < 1.0) return 30;
    return 0;
  });

  return (
    <motion.div
      style={{ y: ty, scale, opacity, zIndex: zIdx }}
      className="absolute inset-0 origin-bottom rounded-[28px] border border-white/[0.18] bg-white/10 p-8 backdrop-blur-2xl"
    >
      <div className="mb-4 flex justify-between">
        <div className="font-mono text-[11px] tracking-[0.12em] opacity-70">
          REVIEW {String(index + 1).padStart(2, "0")} / {String(REVIEWS.length).padStart(2, "0")}
        </div>
        <div>★★★★★</div>
      </div>
      <p className="m-0 text-[20px] font-medium leading-[1.45] tracking-tight">
        “{review.quote}”
      </p>
      <div className="mt-[22px] flex items-center gap-3">
        <div className="font-en flex h-10 w-10 items-center justify-center rounded-full bg-apricot-300 text-[16px] font-extrabold text-burgundy">
          {review.avatar}
        </div>
        <div>
          <div className="text-[14px] font-bold">{review.name}</div>
          <div className="text-[12px] opacity-70">{review.desc}</div>
        </div>
      </div>
    </motion.div>
  );
}
