"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ArrowRight, Sparkles } from "lucide-react";

/**
 * Hero V4 — Bird (Figma "Daily Hero 09" 리메이크, 인픽 다홍 톤)
 * - 4K Kling 붉은새 영상 풀블리드 + 다홍/버건디 그라디언트 합성
 * - 거대 INPICK 워드마크 (Bodoni Moda, gradient white→transparent)
 * - 좌측 하단: "Innovation & security" 헤드라인 + 무료견적 / AIOD 버튼
 * - 우측 하단: 3 글래스 카드 (표준계약 / AI 디자인 / 32%)
 * - 우상단: 사용자 아바타 + Active Users 칩
 */
export default function HeroV4Bird() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [perched, setPerched] = useState(false);

  // 영상 끝에서 멈춤 → 새가 횃대에 앉은 순간 거대 INPICK 워드마크 페이드인
  const handleEnded = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.pause();
      if (Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.05);
    } catch {}
    setPerched(true);
  };

  return (
    <section
      id="hero"
      className="relative h-screen min-h-[760px] w-full overflow-hidden bg-primary-500"
    >
      {/* 1) 베이스 그라디언트 (폴백 + 영상 가장자리 보정) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 60% 55%, #F73B20 0%, #A21906 55%, #360802 100%)",
        }}
      />

      {/* 2) 붉은새 영상 (좌우 반전 — 새가 좌측에서 날아와 횃대에 앉으면 정지) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/hero/bird-end.jpg"
        onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      >
        <source src="/hero/bird.webm" type="video/webm" />
        <source src="/hero/bird.mp4" type="video/mp4" />
      </video>

      {/* 3) 다홍 색상 톤화 — mix-blend-color (휘도 유지, 색상만 다홍으로) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #F73B20 0%, #A21906 60%, #360802 100%)",
          mixBlendMode: "color",
          opacity: 0.92,
        }}
      />

      {/* 4) 어두운 오버레이 (대비/가독 살짝) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(54,8,2,0.05) 0%, rgba(54,8,2,0.35) 70%, rgba(54,8,2,0.65) 100%)",
        }}
      />

      {/* 5) 비네트 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 85% at 50% 45%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* 6) 거대 INPICK 워드마크 — 새 몸통 바로 뒤로, 새가 앉으면 페이드인 */}
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: perched ? 1 : 0, scale: perched ? 1 : 1.04 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="pointer-events-none absolute inset-x-0 top-[28%] z-[2] flex justify-center"
      >
        <span
          className="font-wordmark select-none whitespace-nowrap text-center uppercase text-[23vw] md:text-[clamp(240px,28vw,520px)]"
          style={{
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.045em",
            background:
              "linear-gradient(180deg, rgba(255,246,245,0.98) 0%, rgba(255,246,245,0.62) 70%, rgba(255,246,245,0) 110%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          INPICK
        </span>
      </motion.div>

      {/* (Active Users + 아바타는 카드 바로 위에 위치 — 8) 영역 안에서 함께 렌더) */}

      {/* 7) 좌측 하단 — INPICK 워드마크 + Innovation & standard 헤드라인 + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
        className="absolute bottom-10 left-6 z-10 max-w-[420px] md:bottom-14 md:left-10 lg:bottom-20 lg:left-16 2xl:max-w-[480px]"
      >
        <p
          className="font-host text-offwhite drop-shadow-[0_2px_24px_rgba(54,8,2,0.6)]"
          style={{
            fontSize: "clamp(34px, 3.6vw, 50px)",
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          Innovation
        </p>
        <p
          className="font-host pl-[1em] text-offwhite drop-shadow-[0_2px_24px_rgba(54,8,2,0.6)]"
          style={{
            fontSize: "clamp(34px, 3.6vw, 50px)",
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          <span className="text-offwhite/[0.33]">&amp;</span>
          <span> standard</span>
        </p>

        <p className="font-host mt-5 max-w-[380px] pl-[1em] text-[14px] leading-[1.4] text-offwhite/80 md:text-[15px]">
          AI가 도면·디자인·견적·계약까지 한 흐름으로.
          <br />
          한국 인테리어의 새 표준, 인픽.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3.5 pl-[1em]">
          {/* 무료 견적 받기 (그라디언트 캡슐 + 원형 화살표) */}
          <motion.a
            href="/workflow"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="font-host group relative inline-flex items-center gap-6 rounded-full py-3 pl-6 pr-3 text-[18px] font-medium tracking-[-0.02em] text-offwhite shadow-2xl shadow-burgundy/40"
            style={{
              background:
                "linear-gradient(75deg, #F73B20 9%, #FA8270 110%)",
            }}
          >
            <span>무료 견적 받기</span>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-offwhite/95 transition-transform group-hover:rotate-12">
              <ArrowRight className="h-5 w-5 text-primary-500" />
            </span>
          </motion.a>

          {/* AIOD 알아보기 (흰 캡슐) */}
          <motion.a
            href="https://www.aiod.kr"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="font-host inline-flex items-center gap-2 rounded-full bg-offwhite px-6 py-[18px] text-[18px] font-medium tracking-[-0.02em] text-wine-500 hover:bg-peach-100"
            title="AIOD — 한국 건축의 디지털 표준"
          >
            AIOD
            <ArrowUpRight className="h-4 w-4" />
          </motion.a>
        </div>
      </motion.div>

      {/* 8) 우측 하단 — 3 글래스 카드 + 카드 위 Active Users */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
        className="absolute bottom-10 right-6 z-10 hidden flex-col items-end gap-3 md:bottom-14 md:right-10 lg:bottom-16 lg:right-12 lg:flex 2xl:right-16 2xl:gap-3.5"
      >
        {/* 카드 위쪽: 아바타 (실사진 placeholder — pravatar) + Active Users 칩 */}
        <div className="flex items-center gap-2.5 pr-2">
          <div className="flex -space-x-2.5">
            {[12, 32, 47, 5].map((id, i) => (
              <img
                key={i}
                src={`https://i.pravatar.cc/72?img=${id}`}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full border-2 border-offwhite/85 object-cover shadow-md shadow-burgundy/40"
              />
            ))}
          </div>
          <div
            className="flex items-center gap-2.5 rounded-l-[4px] rounded-r-full border border-offwhite/25 px-5 py-2.5 backdrop-blur-md"
            style={{
              background:
                "linear-gradient(23deg, rgba(255,255,255,0.18) 13%, rgba(255,255,255,0.08) 77%)",
            }}
          >
            <span className="font-host text-[14px] tracking-[-0.03em] text-offwhite/65">
              Active Users
            </span>
            <span className="font-host text-[20px] font-medium tracking-[-0.03em] text-offwhite">
              +352
            </span>
          </div>
        </div>

        {/* 3 카드 가로 배치 */}
        <div className="flex items-end gap-2 2xl:gap-3">
        {/* Card 1 — 표준계약 (3D 글래스 자물쇠 좌측 돌출) */}
        <div className="relative">
          <GlassCard>
            <p
              className="font-host absolute left-[125px] top-[60px] w-[140px] text-[20px] leading-[1.2] tracking-[-0.03em] text-offwhite 2xl:left-[140px] 2xl:top-[64px] 2xl:w-[150px]"
              style={{ fontWeight: 500 }}
            >
              표준계약
              <br />
              보호 시공
            </p>
            <p className="font-host absolute bottom-5 left-[125px] w-[140px] text-[11px] leading-[1.4] text-offwhite/80 2xl:bottom-6 2xl:left-[140px] 2xl:w-[150px] 2xl:text-[12px]">
              법무 검수 완료
              <br />
              표준계약서 보호
            </p>
            <CardArrow href="/contract" />
          </GlassCard>
          {/* 3D 글래스 자물쇠 PNG (다홍 변환본) — 카드 좌측 외곽으로 돌출 */}
          <img
            src="/hero/lock-3d.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -left-[40px] top-[8px] h-[180px] w-[180px] select-none object-contain 2xl:-left-[50px] 2xl:top-[10px] 2xl:h-[210px] 2xl:w-[210px]"
            style={{ filter: "drop-shadow(0 16px 28px rgba(54,8,2,0.55))" }}
          />
        </div>

        {/* Card 2 — Integrated AI Designer (양옆 카드와 동일한 정사각 글래스) */}
        <div className="relative">
          <GlassCard variant="notch">
            <div className="absolute left-6 top-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary-500/15 backdrop-blur-md">
              <Sparkles className="h-6 w-6 text-wine-700" strokeWidth={1.8} />
            </div>
            <p
              className="font-host absolute left-6 top-[100px] w-[200px] text-[20px] leading-[1.15] tracking-[-0.03em] text-wine-700"
              style={{ fontWeight: 500 }}
            >
              Integrated
              <br />
              AI Designer
            </p>
            <p className="font-host absolute bottom-5 left-6 w-[210px] text-[12px] leading-[1.4] text-wine-500/85">
              AI 시안 8장 무료 + AR 합성
            </p>
            <div className="absolute right-3 top-3">
              <CardArrow href="/workflow" light />
            </div>
          </GlassCard>
        </div>

        {/* Card 3 — 32% 평균 절감 */}
        <GlassCard>
          <div className="absolute left-6 top-7 flex items-end">
            <span
              className="font-host text-offwhite"
              style={{
                fontSize: "92px",
                fontWeight: 300,
                letterSpacing: "-0.06em",
                lineHeight: 0.85,
              }}
            >
              32
            </span>
            <span
              className="font-host ml-1 text-offwhite"
              style={{
                fontSize: "46px",
                fontWeight: 300,
                letterSpacing: "-0.04em",
                lineHeight: 1.1,
              }}
            >
              %
            </span>
          </div>
          <p className="font-host absolute bottom-5 left-6 w-[200px] text-[12px] leading-[1.4] text-offwhite/85">
            표준 단가 기반 평균 절감
          </p>
          <CardArrow href="/estimate" />
        </GlassCard>
        </div>
      </motion.div>

      {/* 9) 모바일용 카드 (단순 1장) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
        className="absolute bottom-[calc(100vh-720px+260px)] right-6 z-10 flex max-w-[280px] flex-col gap-2 rounded-2xl border border-offwhite/25 bg-offwhite/10 p-4 backdrop-blur-xl md:hidden"
        style={{ display: "none" }}
      >
        {/* 모바일은 너무 좁아 카드 가림 — 주요 카피만 */}
      </motion.div>

      {/* 10) SCROLL 힌트 */}
      <div className="font-host pointer-events-none absolute bottom-7 left-6 z-10 hidden items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-offwhite/65 lg:flex">
        <span className="block h-7 w-px bg-offwhite/50" />
        scroll
      </div>
    </section>
  );
}

/* ──────────── 글래스 카드 (Figma 디자인 충실) ──────────── */
function GlassCard({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "notch";
}) {
  const isNotch = variant === "notch";
  return (
    <div
      className="relative h-[230px] w-[240px] rounded-[34px] border border-offwhite/20 backdrop-blur-xl 2xl:h-[240px] 2xl:w-[290px]"
      style={{
        background: isNotch
          ? "linear-gradient(135deg, rgba(255,246,245,0.94) 0%, rgba(253,214,206,0.86) 100%)"
          : "linear-gradient(52deg, rgba(255,255,255,0.22) 13%, rgba(122,25,6,0.22) 77%)",
        boxShadow: "0 12px 40px -12px rgba(54,8,2,0.45)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * ㄴ자 박스 카드 (보류) — 정사각 카드로 단순화 후 미사용
 * 향후 다시 쓰려면 여기 함수 부활시키고 Card 2 자리에서 호출하면 됨
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LShapeCard() {
  // bbox: 280w × 320h (80 protrusion + 240 main body)
  // protrusion: x=30..170 (140w), y=0..80
  // main body:  x=0..280, y=80..320
  // outer R=24, inner concave R=18
  const path =
    "M 54 0 L 146 0 A 24 24 0 0 1 170 24 L 170 62 A 18 18 0 0 1 188 80 L 256 80 A 24 24 0 0 1 280 104 L 280 296 A 24 24 0 0 1 256 320 L 24 320 A 24 24 0 0 1 0 296 L 0 104 A 24 24 0 0 1 24 80 L 12 80 A 18 18 0 0 1 30 62 L 30 24 A 24 24 0 0 1 54 0 Z";

  return (
    <div className="relative h-[320px] w-[280px]">
      {/* SVG 본체: 한 덩어리 ㄴ-shape path 를 직접 fill 로 칠함 */}
      <svg
        viewBox="0 0 280 320"
        width="280"
        height="320"
        className="absolute inset-0 overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lcardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF6F5" />
            <stop offset="100%" stopColor="#FDD6CE" />
          </linearGradient>
          <filter id="lcardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="14"
              stdDeviation="18"
              floodColor="#360802"
              floodOpacity="0.5"
            />
          </filter>
        </defs>
        <path
          d={path}
          fill="url(#lcardBg)"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.2"
          filter="url(#lcardShadow)"
        />
      </svg>

      {/* 콘텐츠: 메인 본체 영역(y=80+) 안에서만 */}
      <p
        className="font-host absolute left-6 top-[130px] w-[210px] text-[22px] leading-[1.15] tracking-[-0.03em] text-wine-700"
        style={{ fontWeight: 500 }}
      >
        Integrated
        <br />
        AI Designer
      </p>
      <p className="font-host absolute bottom-6 left-6 w-[220px] text-[12px] leading-[1.4] text-wine-500/85">
        AI 시안 8장 무료 + AR 합성
      </p>

      {/* arrow — 메인 본체 우상단 */}
      <div className="absolute right-3 top-[92px]">
        <CardArrow href="/workflow" light />
      </div>

      {/* 빨간 글래스 orb — protrusion 박스 정중앙 (x=30..170, y=0..80, center ≈ x=100, y=40) */}
      <div className="absolute left-[60px] top-[0px] grid h-[80px] w-[80px] place-items-center">
        <div
          className="absolute inset-0 rounded-full opacity-60 blur-md"
          style={{
            background:
              "radial-gradient(circle, #FFE5DD 0%, #F73B20 60%, transparent 100%)",
          }}
        />
        <div
          className="relative grid h-[72px] w-[72px] place-items-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #FFF6F5 0%, #FA8270 35%, #F73B20 70%, #7A2912 100%)",
            boxShadow:
              "inset -8px -10px 16px rgba(54,8,2,0.4), inset 6px 6px 12px rgba(255,255,255,0.45), 0 6px 18px rgba(247,59,32,0.4)",
          }}
        >
          <Sparkles className="h-7 w-7 text-offwhite drop-shadow-md" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/**
 * 3D 글래스 자물쇠 SVG (보류) — 다홍 변환 PNG 로 교체 후 미사용
 * 향후 다시 쓰려면 함수명에서 _ 제거
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _Glass3DLock() {
  return (
    <div
      className="pointer-events-none absolute -left-[36px] top-[14px] h-[180px] w-[150px] 2xl:-left-[42px] 2xl:top-[20px] 2xl:h-[200px] 2xl:w-[170px]"
      style={{
        filter: "drop-shadow(0 16px 24px rgba(54,8,2,0.55))",
      }}
    >
      <svg viewBox="0 0 160 200" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* 본체 글래스 그라디언트 (붉은 구슬 같은 입체감) */}
          <radialGradient id="lockBody" cx="32%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#FFE5DD" stopOpacity="0.95" />
            <stop offset="22%" stopColor="#FA8270" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#F73B20" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#5A1305" stopOpacity="1" />
          </radialGradient>
          {/* 자물쇠 고리 그라디언트 */}
          <linearGradient id="lockShackle" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDCBC4" />
            <stop offset="50%" stopColor="#F73B20" />
            <stop offset="100%" stopColor="#7A2912" />
          </linearGradient>
          {/* 하이라이트 */}
          <radialGradient id="lockHighlight" cx="35%" cy="22%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* shackle (자물쇠 고리) */}
        <path
          d="M 50 95 V 65 a 30 30 0 0 1 60 0 V 95"
          fill="none"
          stroke="url(#lockShackle)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* shackle 안쪽 음영 */}
        <path
          d="M 50 95 V 65 a 30 30 0 0 1 60 0 V 95"
          fill="none"
          stroke="rgba(54,8,2,0.35)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* 본체 — 둥근 사각형 */}
        <rect x="22" y="88" width="116" height="100" rx="22" fill="url(#lockBody)" />
        {/* 본체 가장자리 */}
        <rect
          x="22"
          y="88"
          width="116"
          height="100"
          rx="22"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
        />

        {/* 큰 하이라이트 (좌상단 글로스) */}
        <ellipse cx="55" cy="115" rx="32" ry="18" fill="url(#lockHighlight)" />
        {/* 작은 하이라이트 점 */}
        <circle cx="42" cy="105" r="5" fill="rgba(255,255,255,0.85)" />

        {/* keyhole (열쇠 구멍) */}
        <circle cx="80" cy="138" r="9" fill="rgba(54,8,2,0.85)" />
        <path d="M 76 138 L 84 138 L 86 162 L 74 162 Z" fill="rgba(54,8,2,0.85)" />

        {/* 하단 림 라이트 */}
        <ellipse cx="80" cy="183" rx="48" ry="3" fill="rgba(255,255,255,0.25)" />
      </svg>
    </div>
  );
}

function CardArrow({ href, light = false }: { href: string; light?: boolean }) {
  return (
    <a
      href={href}
      className={`absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full transition-colors ${
        light
          ? "bg-wine-700/15 text-wine-700 hover:bg-wine-700/25"
          : "bg-offwhite/20 text-offwhite hover:bg-offwhite/30"
      }`}
    >
      <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
    </a>
  );
}
