"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";

/**
 * AIOD 법인 랜딩 — www.aiod.kr 도메인 연결 예정
 * 인픽과 별도의 디자인 언어 (화이트 베이스 + 블루 #1F3CFF 액센트 + 다크 ink)
 * Inter + Pretendard + JetBrains Mono
 */

const TICKER_TEXT = [
  "AIOD · 아이오드",
  "✦",
  "REWRITING THE DIGITAL STANDARD FOR KOREAN ARCHITECTURE",
  "✦",
  "HQ · DAEJEON, KR",
  "✦",
  "60조 시장의 디지털 인프라",
  "✦",
  "INPICK · ARCH INTELLIGENCE · DATA LAYER · TRUST PROTOCOL",
  "✦",
];

interface Product {
  n: string;
  stage: string;
  title: string;
  titleI?: string;
  kr: string;
  desc: string;
  bullets: [string, string][];
  href?: string;
  alt: boolean;
}

const PRODUCTS: Product[] = [
  {
    n: "P—01 / CONSUMER",
    stage: "LIVE",
    title: "InPick",
    kr: "소규모 인테리어 사업자 및 소비자용 AI 인테리어 플랫폼",
    desc: "주거 인테리어를 원하는 소비자가 주소 입력 한 번으로 정확한 견적을 받고, AI 디자인으로 공간을 시뮬레이션하며, 검증된 시공자와 표준 계약까지 진행하는 통합 플랫폼.",
    bullets: [
      ["For", "주거 인테리어 발주자"],
      ["Covers", "견적 → 디자인 → 매칭 → 계약"],
      ["Format", "Web · Mobile"],
      ["Visit", "inpick-app.vercel.app ↗"],
    ],
    href: "https://inpick-app.vercel.app",
    alt: false,
  },
  {
    n: "P—02 / B2B SAAS",
    stage: "IN R&D",
    title: "Architecture",
    titleI: "Intelligence",
    kr: "한국형 자동 설계 보조 SaaS",
    desc: "건축사사무소와 설계 스튜디오를 위한 디지털 어시스턴트. 한국 건축 법규에 최적화된 설계 보조 도구로, 초기 설계안 검토와 도면 표준화 작업을 가속화합니다. 설계자의 창의성을 보조하되, 대체하지 않습니다.",
    bullets: [
      ["For", "건축사사무소 · 설계 스튜디오"],
      ["Covers", "초기 설계 검토 · 도면 표준화"],
      ["Output", "DWG · PDF · Image"],
      ["Status", "Closed Beta · 2026"],
    ],
    alt: true,
  },
  {
    n: "P—03 / DATA",
    stage: "BUILDING",
    title: "Industry",
    titleI: "Data Layer",
    kr: "건축 산업 데이터 인프라",
    desc: "도면, 자재 단가, 시공 사례, 법규, 평면 구조 — 한국 건축 산업에 흩어진 데이터를 표준화된 형태로 통합합니다. 이 데이터 인프라 위에서 산업 전체의 디지털 전환이 가속화됩니다.",
    bullets: [
      ["For", "건설사 · 자재사 · 정부기관"],
      ["Covers", "평면 · 자재 · 단가 · 법규"],
      ["Format", "B2B API"],
      ["Status", "Partner Pilot · 2026"],
    ],
    alt: true,
  },
  {
    n: "P—04 / PROTOCOL",
    stage: "DESIGN",
    title: "Trust",
    titleI: "Protocol",
    kr: "시공 거래 신뢰 인프라",
    desc: "한국 시장의 가장 큰 문제인 '시공 분쟁'을 시스템적으로 해결합니다. 표준 계약서, 단계별 정산, 공정 검증, 분쟁 중재까지 — 거래 전 과정을 신뢰할 수 있게 만듭니다.",
    bullets: [
      ["For", "발주자 · 시공 사업자"],
      ["Covers", "계약 · 정산 · 검증 · 중재"],
      ["Standard", "공정거래위 표준 계약"],
      ["Status", "Roadmap · 2026–27"],
    ],
    alt: false,
  },
];

const IMPACT: [string, string, string, string][] = [
  ["M—01", "견적 산출 시간", "3~7일", "30초"],
  ["M—02", "견적 정확도", "±30%", "±5%"],
  ["M—03", "표준 계약 적용율", "15%", "100%"],
  ["M—04", "시공 분쟁율", "28%", "<5%"],
  ["M—05", "영세 업체 디지털 도구 보급", "5%", "70%"],
];

const NAV = [
  { label: "Mission", href: "#mission" },
  { label: "Products", href: "#products" },
  { label: "Impact", href: "#impact" },
  { label: "Vision", href: "#vision" },
  { label: "Contact", href: "#contact" },
];

export default function AiodLandingClient() {
  return (
    <div className="aiod-root">
      <style jsx global>{`
        .aiod-root {
          --bg: #ffffff;
          --ink: #0a0a0a;
          --ink-2: #1a1a1a;
          --muted: #8a8a85;
          --line: #0a0a0a;
          --line-soft: rgba(10, 10, 10, 0.14);
          --blue: #1f3cff;
          --blue-glow: #2e4bff;
          --blue-deep: #0e27d6;
          background: var(--bg);
          color: var(--ink);
          font-family: "Inter", "Pretendard", "Helvetica Neue", sans-serif;
          font-feature-settings: "ss01", "cv11";
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          min-height: 100vh;
        }
        .aiod-root ::selection {
          background: var(--blue);
          color: #fff;
        }
        .aiod-mono {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          letter-spacing: 0;
        }
        .aiod-kr {
          font-family: "Pretendard", "Inter", sans-serif;
        }
        @keyframes aiod-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes aiod-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <Cursor />
      <AiodNav />
      <Ticker />
      <Hero />
      <Mission />
      <Products />
      <Impact />
      <Approach />
      <Partners />
      <Vision />
      <Team />
      <Advisor />
      <Contact />
    </div>
  );
}

function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    let mx = window.innerWidth / 2,
      my = window.innerHeight / 2,
      cx = mx,
      cy = my;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    const tick = () => {
      cx += (mx - cx) * 0.22;
      cy += (my - cy) * 0.22;
      if (ref.current) {
        ref.current.style.left = cx + "px";
        ref.current.style.top = cy + "px";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    const ents = document.querySelectorAll(
      ".aiod-root a, .aiod-root button, .aiod-pcard, .aiod-leader, .aiod-pill, .aiod-logo-cell"
    );
    const enter = () => setBig(true);
    const leave = () => setBig(false);
    ents.forEach((el) => {
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      ents.forEach((el) => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-1/2 z-[100] hidden -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-[250ms] md:block"
      style={{
        width: big ? 64 : 12,
        height: big ? 64 : 12,
        background: "#1F3CFF",
        mixBlendMode: "difference",
        boxShadow: "0 0 18px rgba(31,60,255,0.6)",
      }}
    />
  );
}

function AiodNav() {
  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center px-7 py-[18px]">
      <a href="#top" className="pointer-events-auto flex items-center gap-2.5">
        <Image
          src="/aiod/aiod-logo.png"
          alt="AIOD"
          width={140}
          height={34}
          priority
          className="h-[34px] w-auto"
        />
      </a>
      <div className="aiod-mono pointer-events-auto hidden items-center gap-7 text-[13px] font-medium uppercase tracking-[0.04em] md:flex">
        {NAV.map((n) => (
          <a
            key={n.label}
            href={n.href}
            className="relative py-1.5 after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-[var(--ink)] after:transition-transform hover:after:scale-x-100"
          >
            {n.label}
          </a>
        ))}
      </div>
      <div className="pointer-events-auto flex items-center justify-self-end gap-4 text-[12px] font-medium uppercase tracking-[0.06em]">
        <span className="aiod-mono">KR · EN</span>
        <span className="aiod-pill inline-flex items-center gap-2 rounded-full border border-current px-3.5 py-2">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{
              background: "#1F3CFF",
              boxShadow: "0 0 10px #1F3CFF",
              animation: "aiod-pulse 1.6s infinite",
            }}
          />
          HQ · DAEJEON
        </span>
      </div>
    </nav>
  );
}

function Ticker() {
  return (
    <div
      aria-hidden
      className="aiod-mono fixed inset-x-0 top-16 z-30 flex h-9 items-center overflow-hidden border-y border-[var(--line-soft)] backdrop-blur"
      style={{ background: "rgba(241,241,236,0.78)" }}
    >
      <div
        className="flex gap-12 whitespace-nowrap text-[12px] font-medium uppercase tracking-[0.14em]"
        style={{ animation: "aiod-scroll 42s linear infinite" }}
      >
        <Track />
        <Track />
      </div>
    </div>
  );
}
function Track() {
  return (
    <span className="inline-flex items-center gap-12">
      {TICKER_TEXT.map((t, i) =>
        t === "✦" ? (
          <em key={i} className="not-italic" style={{ color: "#1F3CFF" }}>
            ✦
          </em>
        ) : (
          <span key={i}>{t}</span>
        )
      )}
    </span>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col justify-between overflow-hidden px-7 pb-14 pt-[140px]"
    >
      <div className="grid grid-cols-2 gap-5 border-b border-[var(--line)] pb-3.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink)] md:grid-cols-4">
        {[
          ["Index / 00", "Digital infrastructure for Korean architecture"],
          ["Located", "36.3624° N · 127.3559° E — Daejeon, KR"],
          ["Category", "Deep-tech · Data · Construction DX"],
          ["Index No.", "AIOD–2026 / VOL.01"],
        ].map(([k, v]) => (
          <div key={k}>
            <span className="mb-1 block text-[10px] text-[var(--muted)]">{k}</span>
            {v}
          </div>
        ))}
      </div>

      <h1
        className="mt-auto max-w-[18ch] font-extrabold leading-[0.88] tracking-[-0.05em]"
        style={{ fontSize: "clamp(72px, 11.6vw, 196px)" }}
      >
        <span className="block">한국 건축의</span>
        <span className="block italic font-semibold" style={{ color: "#1F3CFF" }}>
          디지털 표준을
        </span>
        <span className="flex flex-wrap items-end gap-[0.06em]">
          다시{" "}
          <span
            className="inline-block bg-[var(--ink)] px-[0.12em] pb-[0.04em] not-italic font-extrabold leading-[0.86]"
            style={{ color: "var(--bg)" }}
          >
            씁니다
          </span>
          .
        </span>
      </h1>

      <div className="mt-12 grid grid-cols-1 items-end gap-6 md:grid-cols-3">
        <div className="aiod-kr text-[15px] font-medium leading-[1.55] tracking-[1px]">
          정확한 견적, 검증된 시공자 매칭
          <br />
          AIOD는 한국 건축·인테리어 산업의{" "}
          <span style={{ color: "#1F3CFF" }}>디지털 인프라</span>를 만듭니다.
        </div>
        <div className="flex gap-8 self-end">
          {[
            ["60조", "Market"],
            ["10%", "Digitized"],
            ["2030", "Our OS"],
          ].map(([n, l]) => (
            <div key={l} className="border-l border-[var(--line)] pl-3.5">
              <div className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">{n}</div>
              <div className="aiod-mono mt-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {l}
              </div>
            </div>
          ))}
        </div>
        <div className="aiod-mono justify-self-end flex items-center gap-3.5 text-[11px] uppercase tracking-[0.16em]">
          SCROLL
          <svg width="56" height="14" viewBox="0 0 56 14" fill="none">
            <path d="M0 7H54M54 7L48 1M54 7L48 13" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-[34%] h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #5C72FF, #1F3CFF 55%, #0E27D6 100%)",
          boxShadow:
            "0 0 120px rgba(31,60,255,0.45), inset -40px -60px 90px rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="absolute inset-[6%] rounded-full"
          style={{
            background:
              "conic-gradient(from 220deg, transparent 0 60%, rgba(255,255,255,0.18) 75%, transparent 90%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </section>
  );
}

function SecHead({
  num,
  title,
  meta,
  light,
}: {
  num: string;
  title: string;
  meta: string;
  light?: boolean;
}) {
  return (
    <div
      className={`mb-14 grid grid-cols-[80px_1fr_auto] items-end gap-6 border-b pb-5 pt-7 ${
        light ? "border-[rgba(255,255,255,0.4)]" : "border-[var(--line)]"
      }`}
    >
      <div className="aiod-mono text-[14px] font-semibold tracking-[0.04em]">{num}</div>
      <div className="text-[14px] font-semibold uppercase tracking-[0.06em]">{title}</div>
      <div
        className={`aiod-mono text-[11px] uppercase tracking-[0.12em] ${
          light ? "text-[rgba(255,255,255,0.7)]" : "text-[var(--muted)]"
        }`}
      >
        {meta}
      </div>
    </div>
  );
}

function Mission() {
  return (
    <section id="mission" className="px-7 pb-32 pt-24 text-center">
      <SecHead num="01 / Mission" title="60조 시장의 디지털 인프라" meta="A deep-tech for Korea" />
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        className="aiod-kr mx-auto max-w-[14ch] font-semibold leading-[1.02] tracking-[-0.035em]"
        style={{ fontSize: "clamp(40px, 5.4vw, 88px)" }}
      >
        산업은 거대하지만,
        <br />
        인프라는{" "}
        <em className="italic font-medium" style={{ color: "#1F3CFF" }}>
          부재
        </em>
        합니다.
      </motion.div>
      <div className="mt-16 grid items-stretch gap-8 md:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="relative overflow-hidden bg-cover bg-center"
          style={{
            aspectRatio: "4/5",
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1600&q=80')",
          }}
        >
          <span className="aiod-mono absolute bottom-3.5 left-3.5 bg-[rgba(10,10,10,0.55)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white">
            Korean Apartment Plan
          </span>
        </motion.div>
        <div className="flex flex-col justify-end gap-6">
          <div className="aiod-mono border-t border-[var(--ink)] pt-3 text-left text-[11px] uppercase tracking-[0.16em]">
            <span>What we are</span>
            <b className="mt-1.5 block text-[14px] font-extrabold tracking-[0.04em]">
              AIOD · 아이오드
            </b>
          </div>
          <p className="aiod-kr max-w-[38ch] text-left text-[17px] font-bold leading-[1.7] text-[var(--ink-2)]">
            견적은 공공데이터 기반, 상담은 AI가 부담없이,
            <br />
            <span className="font-bold">
              표현은 딥러닝 기반의 데이터와 Vision 기술을 통해 제공됩니다.
            </span>
            <br />
            AIOD는 이 모든 흐름을{" "}
            <em className="not-italic font-bold" style={{ color: "#1F3CFF" }}>
              데이터
            </em>
            로 잇는, 한국 건축의 디지털 인프라입니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function Products() {
  return (
    <section
      id="products"
      className="px-7 pb-32 pt-24"
      style={{ background: "var(--ink)", color: "var(--bg)" }}
    >
      <SecHead
        num="02 / Products"
        title="한 흐름으로 잇습니다"
        meta="4 services · one protocol"
        light
      />
      <h2
        className="mb-16 font-extrabold leading-[0.92] tracking-[-0.045em]"
        style={{ fontSize: "clamp(56px, 8vw, 128px)" }}
      >
        한 흐름으로{" "}
        <i className="italic font-medium" style={{ color: "#1F3CFF" }}>
          잇습니다
        </i>
        .
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        {PRODUCTS.map((p, i) => (
          <ProductCard key={i} p={p} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({ p }: { p: Product }) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-5% 0px" }}
      transition={{ duration: 0.7 }}
      className="aiod-pcard group relative flex min-h-[480px] cursor-pointer flex-col gap-5 overflow-hidden border border-white/[0.18] p-8 transition-colors hover:bg-[rgba(31,60,255,0.08)]"
      style={
        p.alt
          ? {
              background:
                "linear-gradient(180deg, rgba(31,60,255,0.18) 0%, rgba(10,10,10,0) 70%)",
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="aiod-mono text-[12px] tracking-[0.12em] text-white/60">{p.n}</div>
        <span className="aiod-mono inline-flex items-center gap-1.5 rounded-full border border-white/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/85">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: "#1F3CFF", boxShadow: "0 0 8px #1F3CFF" }}
          />
          {p.stage}
        </span>
      </div>
      <h3
        className="font-bold leading-[0.94] tracking-[-0.04em]"
        style={{ fontSize: "clamp(40px, 4.4vw, 68px)" }}
      >
        {p.title}
        {p.titleI ? (
          <>
            <br />
            <i className="italic font-medium" style={{ color: "#1F3CFF" }}>
              {p.titleI}.
            </i>
          </>
        ) : (
          <i className="italic font-medium" style={{ color: "#1F3CFF" }}>
            .
          </i>
        )}
        <span className="aiod-kr mt-3.5 block text-[0.34em] font-medium leading-[1.25] tracking-normal text-white/55">
          {p.kr}
        </span>
      </h3>
      <p className="aiod-kr max-w-[46ch] text-[15px] leading-[1.7] text-white/[0.78]">{p.desc}</p>
      <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.18] pt-4">
        {p.bullets.map(([k, v]) => (
          <div key={k}>
            <div className="aiod-mono mb-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
              {k}
            </div>
            <div className="text-[13.5px] font-medium leading-[1.45]">{v}</div>
          </div>
        ))}
      </div>
      <span className="absolute right-8 top-8 grid h-[38px] w-[38px] place-items-center rounded-full border border-white/40 transition-all group-hover:rotate-[-45deg] group-hover:border-[#1F3CFF] group-hover:bg-[#1F3CFF]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 13L13 1M13 1H4M13 1V10" stroke="currentColor" />
        </svg>
      </span>
    </motion.div>
  );
  return p.href ? (
    <a href={p.href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function Impact() {
  return (
    <section
      id="impact"
      className="relative overflow-hidden px-7 py-32"
      style={{ background: "#1F3CFF", color: "#fff" }}
    >
      <SecHead num="03 / Impact" title="숫자로 보는 변화" meta="Goals, not estimates" light />
      <h2
        className="mb-16 font-extrabold leading-[0.92] tracking-[-0.045em]"
        style={{ fontSize: "clamp(56px, 8.4vw, 132px)" }}
      >
        추정이 아닌, <i className="italic font-medium opacity-85">목표</i>.
      </h2>
      <div className="border-t border-white/40">
        {IMPACT.map(([k, lab, from, to]) => (
          <div
            key={k}
            className="grid grid-cols-[80px_1.4fr_1.4fr_auto_1.4fr] items-center gap-6 border-b border-white/40 py-7"
          >
            <div className="aiod-mono text-[12px] tracking-[0.12em] opacity-85">{k}</div>
            <div className="aiod-kr text-[18px] font-semibold tracking-[-0.01em]">{lab}</div>
            <div className="aiod-mono text-[14px] line-through decoration-1 opacity-70">{from}</div>
            <div className="aiod-mono text-[18px] opacity-60">→</div>
            <div className="text-[32px] font-extrabold leading-none tracking-[-0.025em]">{to}</div>
          </div>
        ))}
      </div>
      <div className="aiod-kr mt-9 max-w-[48ch] text-[14px] tracking-[0.04em] opacity-85">
        이 변화는 추정이 아닌 목표입니다. AIOD는 명확한 지표 위에서 산업을 바꿉니다.
        <br />한국에서 집을 짓고 꾸미는 모든 사람이 더 나은 도구를 가질 자격이 있습니다.
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[26%] -left-[2%] font-extrabold leading-[0.8] tracking-[-0.06em]"
        style={{ fontSize: "clamp(280px, 40vw, 640px)", color: "rgba(255,255,255,0.07)" }}
      >
        AIOD
      </div>
    </section>
  );
}

function Approach() {
  return (
    <section className="px-7 pb-32 pt-24">
      <SecHead num="04 / Approach" title="한국에서, 한국을 위해" meta="Local depth" />
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9 }}
        className="aiod-kr max-w-[12ch] font-semibold leading-[1.02] tracking-[-0.035em]"
        style={{ fontSize: "clamp(40px, 5.4vw, 88px)" }}
      >
        한국에서,
        <br />
        한국을{" "}
        <em className="italic font-medium" style={{ color: "#1F3CFF" }}>
          위해
        </em>
        .
      </motion.div>
      <div className="mt-16 grid gap-5 md:grid-cols-[1.2fr_1fr_1fr]">
        {[
          {
            url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80",
            cap: "Site · Seoul",
            ratio: "4/5",
          },
          {
            url: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80",
            cap: "Interior · Material",
            ratio: "3/5",
          },
          {
            url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=80",
            cap: "Drawing · Detail",
            ratio: "3/5",
          },
        ].map((g) => (
          <div
            key={g.cap}
            className="relative overflow-hidden bg-cover bg-center"
            style={{ aspectRatio: g.ratio, backgroundImage: `url('${g.url}')` }}
          >
            <span className="aiod-mono absolute bottom-3.5 left-3.5 bg-[rgba(10,10,10,0.55)] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white">
              {g.cap}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-9 grid items-start gap-8 border-t border-[var(--line-soft)] pt-6 md:grid-cols-[1fr_2fr]">
        <div className="aiod-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Local depth
        </div>
        <p className="aiod-kr max-w-[62ch] text-[16px] leading-[1.7] text-[var(--ink-2)]">
          한국 아파트의 특수성, 법규의 복잡성, 시공 시장의 관행 — 글로벌 솔루션이 못 푸는 디테일을{" "}
          <em className="not-italic font-semibold" style={{ color: "#1F3CFF" }}>
            한국 데이터
          </em>{" "}
          위에서 풉니다.
        </p>
      </div>
    </section>
  );
}

function Partners() {
  const cells = [
    { label: "", big: true },
    { label: "충남대학교 건축공학과", small: true },
    { label: "POSCON Holdings", big: true, feat: true },
    { label: "" },
    { label: "", big: true },
    { label: "" },
    { label: "" },
    { label: "", big: true },
    { label: "" },
    { label: "" },
    { label: "자재 유통 파트너", big: true },
    { label: "공공·정부기관" },
  ];
  return (
    <section className="border-t border-[var(--line)] px-7 py-20">
      <div className="flex items-end justify-between border-b border-[var(--line)] pb-7">
        <h3
          className="aiod-kr max-w-[22ch] font-semibold leading-[1.05] tracking-[-0.03em]"
          style={{ fontSize: "clamp(28px, 3.4vw, 52px)" }}
        >
          함께 일하는{" "}
          <em className="italic font-medium" style={{ color: "#1F3CFF" }}>
            동료들
          </em>
          .
        </h3>
        <div className="aiod-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Academic · Industry · Public
        </div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`aiod-logo-cell aiod-mono grid place-items-center border-b border-r border-[var(--line-soft)] px-3 text-center text-[13px] tracking-[0.04em] transition-colors ${
              i % 6 === 5 ? "md:border-r-0" : ""
            } ${c.big ? "text-[17px] font-bold tracking-[-0.02em]" : ""} ${c.small ? "text-[12px] font-bold" : ""}`}
            style={{
              aspectRatio: "5/2",
              fontFamily: c.big && !c.small ? "Inter, sans-serif" : undefined,
              background: c.feat ? "#1F3CFF" : undefined,
              color: c.feat ? "#fff" : undefined,
            }}
          >
            {c.label}
          </div>
        ))}
      </div>
      <div className="mt-9 grid items-start gap-8 border-t border-[var(--line-soft)] pt-6 md:grid-cols-[1fr_2fr]">
        <div className="aiod-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Featured Collaboration
        </div>
        <p className="text-[15px] leading-[1.7] text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">POSCON Holdings</b>
        </p>
      </div>
    </section>
  );
}

function Vision() {
  return (
    <section id="vision" className="border-t border-[var(--line)] px-7 py-32" style={{ background: "var(--bg)" }}>
      <SecHead num="05 / Vision" title="2030, 한국 건축의 운영체제" meta="North star — 2030" />
      <div className="grid items-start gap-10 md:grid-cols-[1fr_2fr]">
        <div className="aiod-mono border-t border-[var(--ink)] pt-3 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <span>Where we go</span>
          <b className="mt-1.5 block text-[14px] font-extrabold tracking-[0.04em] text-[var(--ink)]">
            Operating System
          </b>
        </div>
        <div>
          <h2
            className="font-semibold leading-none tracking-[-0.04em]"
            style={{ fontSize: "clamp(48px, 7.2vw, 116px)" }}
          >
            2030,
            <br />
            한국 건축의
            <br />
            <i className="italic font-medium" style={{ color: "#1F3CFF" }}>
              운영체제
            </i>
            .
          </h2>
          <p className="aiod-kr mt-9 max-w-[62ch] text-[17px] leading-[1.7] text-[var(--ink-2)]">
            설계자, 시공자, 발주자, 자재 공급사가 하나의 디지털 프로토콜 위에서 일합니다. 견적은 30초 안에 정확하고, 계약은 표준화되어 분쟁이 없으며, 모든 거래는 투명하게 기록됩니다.
            <br />이것이 AIOD가 만드는 한국 건축의 미래입니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="team" className="border-t border-[var(--line)] px-7 pb-32 pt-24">
      <SecHead num="06 / Leadership" title="대전에서, 한국 건축의 다음 10년" meta="AIOD CO., LTD." />
      <div className="grid grid-cols-1 border-t border-[var(--line)] md:grid-cols-2">
        <Leader
          photo="/aiod/team/kim-sunbon.jpg"
          cap="CEO"
          role="CEO · CTO · 대표이사"
          name="김선본"
          en="Seonbon Kim"
          tag="기획 · 기술 개발 총괄"
          edu={[["B.A. 충남대학교 건축학 (5년)", "2018"]]}
          career={[
            ["1군 건설사 엔지니어", "8년차"],
            ["건설기술인 협회 고급 기술자", ""],
            ["중소 건설사 사내 ERP 시스템 개발", ""],
            ["건축 디자인 3D 웹 서비스 기획·개발", ""],
            ["인테리어 공사업 '비와이 실내 디자인' 운영", ""],
            ["인테리어 전자계약 솔루션 기획·개발", ""],
          ]}
          rightBorder
        />
        <Leader
          photo="/aiod/team/kwon-changjin.jpg"
          cap="COO"
          role="COO · UX/UI VISION 기술 담당"
          name="권창진"
          en="Changjin Kwon"
          tag="최고 운영 책임자"
          edu={[
            ["B.A. Architectural Association (UK)", "2023"],
            ["Dipl. Architectural Association (UK)", "2026"],
          ]}
          career={[
            ["Python · Rhino 기술 보유", ""],
            ["웹 인테리어 디자인 솔루션 스타트업 (UK)", ""],
          ]}
          leftPad
        />
      </div>
    </section>
  );
}

function Leader({
  photo,
  cap,
  role,
  name,
  en,
  tag,
  edu,
  career,
  rightBorder,
  leftPad,
}: {
  photo: string;
  cap: string;
  role: string;
  name: string;
  en: string;
  tag: string;
  edu: [string, string][];
  career: [string, string][];
  rightBorder?: boolean;
  leftPad?: boolean;
}) {
  return (
    <div
      className={`aiod-leader aiod-kr grid items-start gap-9 border-b border-[var(--line)] py-10 md:grid-cols-[200px_1fr] ${
        rightBorder ? "md:border-r md:border-[var(--line)] md:pr-10" : ""
      } ${leftPad ? "md:pl-10" : ""}`}
    >
      <div
        className="relative w-full overflow-hidden bg-cover bg-center"
        style={{
          aspectRatio: "4/5",
          backgroundImage: `url(${photo})`,
          filter: "grayscale(1) contrast(1.02)",
        }}
      >
        <span className="aiod-mono absolute bottom-2.5 left-2.5 bg-[rgba(10,10,10,0.6)] px-1.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white">
          {cap}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="aiod-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {role}
          </div>
          <div
            className="mt-2.5 font-bold leading-none tracking-[-0.035em]"
            style={{ fontSize: "clamp(34px, 3.6vw, 52px)" }}
          >
            {name}
            <span className="mt-2 block text-[0.34em] font-medium tracking-normal text-[var(--muted)]">
              {en}
            </span>
          </div>
          <div className="mt-1 text-[13px] leading-[1.55] text-[var(--ink-2)]">{tag}</div>
        </div>
        <div className="border-t border-[var(--line-soft)] pt-3.5">
          <div className="aiod-mono mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1F3CFF" }}>
            학력
          </div>
          <ul className="flex flex-col gap-1">
            {edu.map(([t, y], i) => (
              <li key={i} className="text-[13.5px] leading-[1.55]">
                {t}
                {y && (
                  <span className="aiod-mono ml-2 text-[11px] tracking-[0.04em] text-[var(--muted)]">
                    {y}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-[var(--line-soft)] pt-3.5">
          <div className="aiod-mono mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1F3CFF" }}>
            주요 경력
          </div>
          <ul className="flex flex-col gap-1">
            {career.map(([t, y], i) => (
              <li key={i} className="text-[13.5px] leading-[1.55]">
                {t}
                {y && (
                  <span className="aiod-mono ml-2 text-[11px] tracking-[0.04em] text-[var(--muted)]">
                    {y}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Advisor() {
  return (
    <section className="px-7 pb-32">
      <div className="aiod-kr grid items-start gap-12 border-t border-[var(--line)] pt-12 md:grid-cols-[1fr_1.4fr]">
        <div className="grid items-start gap-8 md:grid-cols-[200px_1fr]">
          <div
            className="relative w-full overflow-hidden bg-cover bg-center"
            style={{
              aspectRatio: "4/5",
              backgroundImage: "url('/aiod/team/kwon-inso.jpg')",
              filter: "grayscale(1) contrast(1.02)",
            }}
          >
            <span className="aiod-mono absolute bottom-2.5 left-2.5 bg-[rgba(10,10,10,0.6)] px-1.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white">
              Advisor
            </span>
          </div>
          <div>
            <div className="aiod-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              기술자문위원 · Technical Advisor
            </div>
            <div
              className="mt-2.5 font-bold leading-none tracking-[-0.035em]"
              style={{ fontSize: "clamp(40px, 4.2vw, 60px)" }}
            >
              권인소
              <span className="mt-2 block text-[0.32em] font-medium tracking-normal text-[var(--muted)]">
                In-So Kweon
              </span>
            </div>
            <div className="mt-3.5 text-[13px] leading-[1.55] text-[var(--ink-2)]">
              AI · 딥테크 기술 자문, 개발 인력 지원
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="border-t border-[var(--line-soft)] pt-3.5">
            <div className="aiod-mono mb-2.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1F3CFF" }}>
              학력
            </div>
            <ul className="flex flex-col gap-1.5">
              {[
                ["B.A. 서울대학교", "1981"],
                ["M.S. 서울대학교", "1983"],
                ["Ph.D. Carnegie Mellon University", "1990"],
              ].map(([t, y]) => (
                <li key={t} className="text-[14px] leading-[1.6]">
                  {t}
                  <span className="aiod-mono ml-2 text-[11px] tracking-[0.04em] text-[var(--muted)]">
                    {y}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-[var(--line-soft)] pt-3.5">
            <div className="aiod-mono mb-2.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#1F3CFF" }}>
              주요 경력
            </div>
            <ul className="flex flex-col gap-1.5">
              {[
                ["현, KIST 국가특임연구원", "2026 ~"],
                ["KAIST 전기및전자공학부 명예 교수", "1992 ~"],
              ].map(([t, y]) => (
                <li key={t} className="text-[14px] leading-[1.6]">
                  {t}
                  <span className="aiod-mono ml-2 text-[11px] tracking-[0.04em] text-[var(--muted)]">
                    {y}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="relative px-7 pb-7 pt-32">
      <SecHead num="07 / Contact" title="한국 건축의 다음 장을 함께" meta="Reply within 24h · KST" />
      <div
        className="font-extrabold leading-[0.94] tracking-[-0.05em]"
        style={{ fontSize: "clamp(56px, 9.4vw, 156px)" }}
      >
        Write the
        <br />
        <i className="italic font-medium" style={{ color: "#1F3CFF" }}>
          next chapter
        </i>{" "}
        of
        <br />
        Korean architecture.{" "}
        <span className="not-italic" style={{ color: "#1F3CFF" }}>
          ↗
        </span>
      </div>
      <div className="mt-20 grid grid-cols-1 gap-5 border-t border-[var(--line)] pt-8 md:grid-cols-12">
        {(
          [
            ["Headquarters · 본사", "p", null, "대전광역시 유성구 대학로 82, 539-2호\nAIOD CO., LTD."],
            ["General · 문의", "links", [
              ["lookingseon@aiod.kr", "mailto:lookingseon@aiod.kr"],
              ["inpick-app.vercel.app ↗", "https://inpick-app.vercel.app"],
            ]],
            ["Partnership · 제휴", "links", [
              ["파트너십 / 협력 제안", "mailto:lookingseon@aiod.kr"],
              ["투자 / Press", "mailto:lookingseon@aiod.kr"],
            ]],
            ["Talent · 채용", "links", [
              ["함께 만들 사람", "mailto:lookingseon@aiod.kr"],
              ["Open Roles ↗", "#"],
            ]],
          ] as Array<[string, string, [string, string][] | null, string?]>
        ).map(([label, kind, links, p]) => (
          <div key={label} className="md:col-span-3">
            <div className="aiod-mono mb-3.5 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {label}
            </div>
            {kind === "p" ? (
              <p className="aiod-kr whitespace-pre-line text-[15px] font-medium leading-[1.7]">{p}</p>
            ) : (
              <div className="aiod-kr flex flex-col gap-1">
                {links!.map(([t, h]) => (
                  <a
                    key={t}
                    href={h}
                    target={h.startsWith("http") ? "_blank" : undefined}
                    rel={h.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="block text-[15px] font-medium leading-[1.7] hover:text-[#1F3CFF]"
                  >
                    {t}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="aiod-mono mt-32 flex items-end justify-between gap-6 border-t border-[var(--line)] py-6 text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">
        <div className="flex items-end">
          <Image
            src="/aiod/aiod-logo.png"
            alt="AIOD"
            width={860}
            height={210}
            className="h-auto"
            style={{ width: "clamp(280px, 52vw, 860px)" }}
          />
        </div>
        <div className="text-right">
          아이오드
          <br />
          The OS for
          <br />
          Korean architecture
        </div>
      </div>
      <div className="aiod-mono mt-6 grid grid-cols-1 gap-6 border-t border-[var(--line-soft)] pt-4 text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] md:grid-cols-[1.2fr_1.4fr_1fr_1fr]">
        <span>© 2026 AIOD CO., LTD.</span>
        <span>
          대표이사 김선본
          <br />
          사업자등록번호 384-81-04107
        </span>
        <span>대전광역시 유성구 대학로 82, 539-2호</span>
        <span>lookingseon@aiod.kr</span>
      </div>
    </section>
  );
}
