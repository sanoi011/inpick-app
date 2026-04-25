"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { User, Building2 } from "lucide-react";

/**
 * 헤더 V4 — 좌측 로고 + 우측 "소비자 로그인" / "사업자 로그인" 2버튼
 * 섹션별 컬러 자동 전환 (dark/light)
 */
export default function HeaderV4() {
  const [mode, setMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const sections = ["hero", "walkthrough", "demo", "mob", "test", "final"];
    const onScroll = () => {
      const y = window.scrollY + 36;
      const positions = sections.map((id) => {
        const el = document.getElementById(id);
        return { id, top: el?.offsetTop ?? Infinity };
      });
      let current = "hero";
      for (const p of positions) if (y >= p.top) current = p.id;
      if (current === "walkthrough" || current === "demo") setMode("light");
      else setMode("dark");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = mode === "dark";

  return (
    <header className="fixed inset-x-0 top-0 z-[100] h-[72px]">
      <nav
        className={`mx-auto flex h-full max-w-[1280px] items-center justify-between px-6 transition-colors duration-300 lg:px-10 ${
          isDark ? "text-offwhite" : "text-ink"
        }`}
      >
        <div className="flex items-end gap-2.5">
          <a href="/" className="flex items-center gap-2">
            <span
              className={`hex-mask h-5 w-5 transition-colors ${
                isDark ? "text-offwhite" : "text-primary-500"
              }`}
            />
            <span className="font-en text-[20px] font-extrabold tracking-[-0.04em]">inpick</span>
          </a>
          <a
            href="https://www.aiod.kr"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-en mb-[2px] hidden text-[13px] font-light tracking-[0.04em] opacity-80 transition-opacity hover:opacity-100 sm:inline ${
              isDark ? "text-offwhite" : "text-ink"
            }`}
            title="AIOD — 한국 건축의 디지털 표준"
          >
            AIOD
          </a>
        </div>

        <div className="flex items-center gap-2 text-[13px] sm:gap-2.5 sm:text-[14px]">
          <motion.a
            href="/auth?type=consumer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-semibold transition-colors sm:px-4 ${
              isDark
                ? "border-offwhite/40 bg-transparent text-offwhite hover:bg-offwhite/10"
                : "border-ink/15 bg-transparent text-ink hover:bg-ink/5"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">소비자 </span>로그인
          </motion.a>
          <motion.a
            href="/auth?type=contractor"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold transition-colors sm:px-4 ${
              isDark
                ? "bg-offwhite text-primary-500 hover:bg-offwhite/90"
                : "bg-ink text-offwhite hover:bg-ink/90"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">사업자 </span>로그인
          </motion.a>
        </div>
      </nav>
    </header>
  );
}
