"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { trackClientEvent } from "@/lib/analytics/client";
import { AnalyticsEvents } from "@/lib/analytics/events";

// 실제 스토어 URL (StoreFloatingBadges와 동일 env). 출시 후 env 값이 실제 앱으로 연결됨.
const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL || "https://www.apple.com/app-store/";
const GOOGLE_PLAY_URL =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || "https://play.google.com/store";

export default function MobileMockV4() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const phoneX = useTransform(scrollYProgress, [0, 0.5], [120, 0]);
  const phoneRot = useTransform(scrollYProgress, [0, 0.5], [-10, -4]);
  const textX = useTransform(scrollYProgress, [0, 0.5], [-60, 0]);
  const textOp = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  return (
    <section
      id="mob"
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-wine-600 px-[60px] py-[120px] text-offwhite"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(247,59,32,0.18), transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(54,8,2,0.5), transparent 50%)",
        }}
      />
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-20 lg:grid-cols-2">
        <motion.div style={{ x: textX, opacity: textOp }}>
          <div className="font-mono mb-[18px] text-[12px] tracking-[0.16em] text-apricot-300">
            ◇ MOBILE-FIRST
          </div>
          <h2
            className="m-0 font-extrabold leading-[0.98] tracking-tightest"
            style={{ fontSize: "clamp(40px, 5.5vw, 70px)" }}
          >
            한 손으로 끝내는
            <br />
            <span className="text-apricot-300">
              인테리어의
              <br />
              모든 일.
            </span>
          </h2>
          <p className="mt-7 max-w-[460px] text-[17px] leading-[1.6] text-apricot-300/75">
            견적 → AR 확인 → 표준계약 서명까지. iOS · Android 모두 지원하며, 평균 12분 안에 첫 견적이 손 안에 도착합니다.
          </p>
          <div className="mt-8 flex gap-3">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackClientEvent(AnalyticsEvents.StoreBadgeClicked, {
                  props: { store: "app_store", placement: "mobile_first_section" },
                })
              }
              className="font-en rounded-full bg-offwhite px-5 py-3 text-[13px] font-semibold text-ink transition hover:scale-[1.03] hover:bg-white"
            >
              App Store
            </a>
            {/* 안드로이드 정식 출시 전 — '곧 출시' 비활성. 출시 후 아래를 App Store와 동일한 <a>로 교체. */}
            <span
              aria-disabled="true"
              className="font-en inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-apricot-300/25 px-5 py-3 text-[13px] font-semibold text-offwhite/50"
            >
              Play Store
              <span className="rounded-full bg-apricot-300/20 px-1.5 py-0.5 text-[10px] font-bold text-apricot-300">곧 출시</span>
            </span>
          </div>
        </motion.div>

        <motion.div style={{ x: phoneX, rotate: phoneRot }} className="flex justify-center">
          <div
            className="relative h-[640px] w-[320px] rounded-[44px] bg-[#0E0202] p-2.5"
            style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)" }}
          >
            <div className="absolute left-1/2 top-3.5 z-[5] h-7 w-[110px] -translate-x-1/2 rounded-[18px] bg-[#0E0202]" />
            <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-offwhite p-[18px] pt-14 text-ink">
              <div className="font-en absolute inset-x-6 top-4 flex justify-between text-[12px] font-semibold">
                <span>9:41</span>
                <span>●●●● ◐</span>
              </div>
              <div className="mb-3.5 flex items-center gap-1.5">
                <span className="hex-mask h-3.5 w-3.5 text-primary-500" />
                <span className="font-en text-[13px] font-extrabold tracking-tightest">inpick</span>
              </div>
              <div className="mb-4 rounded-[14px] bg-apricot-100 px-3 py-2.5 text-[11px] text-ink-60">
                <div className="font-mono mb-0.5 text-[8px] tracking-[0.12em] text-primary-500">
                  ADDRESS
                </div>
                대전 유성구 봉명동 84.9㎡
              </div>
              <div className="font-mono text-[9px] tracking-[0.12em] text-ink-40">AI ESTIMATE</div>
              <div className="font-en mt-1 text-[36px] font-black leading-none tracking-[-0.05em]">
                ₩38,420,000
              </div>
              <div className="font-mono mt-1 text-[9px] text-ink-60">
                ± 4.2% · 표준단가 17K 적용
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {[
                  { label: "철거·폐기", pct: 11, w: 26 },
                  { label: "도장·도배", pct: 25, w: 60 },
                  { label: "주방·욕실", pct: 37, w: 89, accent: true },
                  { label: "조명·전기", pct: 27, w: 65 },
                ].map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-[10px] font-semibold">{b.label}</span>
                      <span className="font-mono text-[9px] text-ink-60">{b.pct}%</span>
                    </div>
                    <div className="h-1 rounded bg-apricot-100">
                      <div
                        className={`h-full rounded ${b.accent ? "bg-primary-500" : "bg-burgundy"}`}
                        style={{ width: `${b.w}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-[18px] bottom-6 rounded-full bg-primary-500 py-3.5 text-center text-[13px] font-bold text-white">
                표준계약 서명 →
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
