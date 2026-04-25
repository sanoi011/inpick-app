"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Estimate Live V4 — 살구 그라데이션 blob 배경 + 카운트업 + 4 progress bar
 */

interface Sample {
  short: string;
  area: string;
  base: number;
  items: { label: string; v: number; pct: number }[];
}

const SAMPLES: Sample[] = [
  {
    short: "유성구",
    area: "84.9㎡ · 25.7평 · 풀 리노베이션 기준",
    base: 38420000,
    items: [
      { label: "철거·폐기", v: 4280000, pct: 11 },
      { label: "도장·도배", v: 9620000, pct: 25 },
      { label: "주방·욕실", v: 14340000, pct: 37 },
      { label: "조명·전기", v: 10180000, pct: 27 },
    ],
  },
  {
    short: "강남구",
    area: "59.5㎡ · 18.0평 · 풀 리노베이션 기준",
    base: 31280000,
    items: [
      { label: "철거·폐기", v: 3120000, pct: 10 },
      { label: "도장·도배", v: 7820000, pct: 25 },
      { label: "주방·욕실", v: 12480000, pct: 40 },
      { label: "조명·전기", v: 7860000, pct: 25 },
    ],
  },
  {
    short: "수원시",
    area: "113.0㎡ · 34.2평 · 풀 리노베이션 기준",
    base: 51640000,
    items: [
      { label: "철거·폐기", v: 6200000, pct: 12 },
      { label: "도장·도배", v: 12910000, pct: 25 },
      { label: "주방·욕실", v: 19620000, pct: 38 },
      { label: "조명·전기", v: 12910000, pct: 25 },
    ],
  },
];

const ADDR = ["유성구 봉명동 84.9㎡", "강남구 역삼동 59.5㎡", "수원시 영통구 113㎡"];

export default function EstimateLiveV4() {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const sample = SAMPLES[idx];

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = shown;
    const dur = 1400;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.floor(from + (sample.base - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <section
      id="demo"
      className="relative min-h-screen overflow-hidden bg-apricot-100 px-10 py-[100px] text-ink"
    >
      {/* 살구 그라데이션 blob 배경 */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute"
          style={{
            top: -100,
            right: -100,
            width: 600,
            height: 600,
            background: "radial-gradient(circle, #F5B1A3 0%, #FDD6CE 35%, transparent 70%)",
            opacity: 0.7,
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: -150,
            left: -150,
            width: 700,
            height: 700,
            background: "radial-gradient(circle, #FDD6CE 0%, #FEE9E6 50%, transparent 75%)",
            opacity: 0.8,
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "30%",
            left: "30%",
            width: 400,
            height: 400,
            background: "radial-gradient(circle, #FDCBC4 0%, transparent 65%)",
            opacity: 0.5,
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1280px]">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="font-mono mb-3.5 text-[12px] tracking-[0.16em] text-primary-500">
              ◇ LIVE ESTIMATE
            </div>
            <h2
              className="m-0 font-extrabold leading-none tracking-tightest"
              style={{ fontSize: "clamp(36px, 5vw, 60px)" }}
            >
              직접 눌러보세요.
              <br />
              <span className="text-primary-500">실제 견적이 나옵니다.</span>
            </h2>
          </div>
          <div className="font-mono text-right text-[11px] leading-[1.6] text-ink-60">
            DATA · 17,000건 표준단가
            <br />
            UPDATED · 2026.04
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* 샘플 버튼 3개 */}
          <div className="flex flex-col gap-3">
            <div className="font-mono mb-1 text-[11px] tracking-[0.12em] text-ink-40">
              SAMPLE ADDRESSES
            </div>
            {SAMPLES.map((s, i) => {
              const sel = idx === i;
              return (
                <button
                  key={s.short}
                  onClick={() => setIdx(i)}
                  className={`block rounded-[20px] border-0 px-[22px] py-[18px] text-left transition-all ${
                    sel ? "bg-ink text-offwhite" : "bg-white text-ink hover:translate-y-[-2px]"
                  }`}
                >
                  <div className="font-mono mb-1 text-[11px] tracking-[0.08em] opacity-60">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="text-[16px] font-bold tracking-[-0.02em]">{ADDR[i]}</div>
                  <div className="mt-0.5 text-[12px] opacity-70">
                    {s.area.split(" · ").slice(0, 2).join(" · ")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 견적 카드 */}
          <div className="rounded-[28px] border border-ink-6 bg-white p-9">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[11px] tracking-[0.12em] text-ink-40">
                  PROJECTED · {sample.short}
                </div>
                <div className="mt-1 text-[13px] text-ink-60">{sample.area}</div>
              </div>
              <span className="font-mono inline-flex items-center gap-1.5 rounded-full border border-primary-500 px-3 py-1.5 text-[11px] text-primary-500">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" />
                LIVE
              </span>
            </div>
            <div
              className="font-en mt-[18px] font-black leading-none tracking-[-0.05em]"
              style={{ fontSize: "clamp(56px, 9vw, 110px)" }}
            >
              ₩{shown.toLocaleString("ko-KR")}
            </div>
            <div className="font-mono mt-1 text-[12px] text-ink-60">± 4.2% · COUNT-UP</div>

            <div className="mt-7 flex flex-col gap-4">
              {sample.items.map((it, i) => (
                <BarRow key={it.label} item={it} accent={i === 2} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BarRow({
  item,
  accent,
}: {
  item: { label: string; v: number; pct: number };
  accent: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = "0%";
    const t = setTimeout(() => {
      el.style.width = `${item.pct * 2.4}%`;
    }, 100);
    return () => clearTimeout(t);
  }, [item.pct]);
  return (
    <div>
      <div className="mb-1.5 flex justify-between">
        <span className="text-[14px] font-semibold">{item.label}</span>
        <span className="font-mono text-[13px] text-ink-60">
          ₩{item.v.toLocaleString("ko-KR")} · {item.pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-apricot-100">
        <div
          ref={barRef}
          className={`h-full rounded transition-[width] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] ${
            accent ? "bg-primary-500" : "bg-burgundy"
          }`}
        />
      </div>
    </div>
  );
}
