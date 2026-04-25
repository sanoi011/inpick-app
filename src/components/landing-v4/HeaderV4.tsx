"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

const NAV = [
  { label: "Personal", href: "#walkthrough" },
  { label: "Business", href: "/contractor/register" },
  { label: "Company", href: "/aiod" },
  { label: "Help", href: "#demo" },
];

/**
 * Section-aware nav: dark text on light sections, light text on colored sections.
 * 동적으로 섹션 위치 측정해서 mode 전환.
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
      // 어느 섹션에 있는지
      let current = "hero";
      for (const p of positions) if (y >= p.top) current = p.id;
      // light 배경: walkthrough, demo
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
        className={`mx-auto flex h-full max-w-[1280px] items-center justify-between px-10 transition-colors duration-300 ${
          isDark ? "text-offwhite" : "text-ink"
        }`}
      >
        <a href="/" className="flex items-center gap-2">
          <span
            className={`hex-mask h-5 w-5 transition-colors ${isDark ? "text-offwhite" : "text-primary-500"}`}
          />
          <span className="font-en text-[20px] font-extrabold tracking-[-0.04em]">inpick</span>
        </a>
        <div className="hidden gap-8 text-[14px] font-medium md:flex">
          {NAV.map((n) => (
            <a key={n.label} href={n.href} className="opacity-90 hover:opacity-100">
              {n.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[14px]">
          <a href="/auth" className="opacity-90 hover:opacity-100">
            Log in
          </a>
          <motion.a
            href="/project/new"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`rounded-full px-[18px] py-[9px] font-semibold transition-colors ${
              isDark ? "bg-offwhite text-primary-500" : "bg-ink text-offwhite"
            }`}
          >
            Sign up
          </motion.a>
        </div>
      </nav>
    </header>
  );
}
