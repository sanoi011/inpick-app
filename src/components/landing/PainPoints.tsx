"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

const PAIN_POINTS = [
  "불투명한 견적 비용",
  "업체마다 다른 단가",
  "감으로 때우는 공사비",
  "선행공정 누락 추가비용",
  "믿을 수 없는 시세 정보",
  "시간만 잡아먹는 비교견적",
  "전문지식 없는 소비자의 불안",
];

export default function PainPoints() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % PAIN_POINTS.length);
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const getVisibleItems = () => {
    const items = [];
    for (let i = -2; i <= 2; i++) {
      const index = (currentIndex + i + PAIN_POINTS.length) % PAIN_POINTS.length;
      items.push({ text: PAIN_POINTS[index], position: i, index });
    }
    return items;
  };

  const getOpacity = (position: number) => {
    switch (position) { case 0: return 1; case -1: case 1: return 0.4; default: return 0.15; }
  };

  const gradientStyle = {
    backgroundImage: "linear-gradient(90deg, #2563EB 0%, #3B82F6 36%, #7C3AED 70%, #EC4899 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  };

  return (
    <section className="relative w-full py-24 md:py-32 lg:py-40 overflow-hidden" style={{ backgroundColor: "#F5F5F0" }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <motion.h2 initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-gray-900">
              Say Goodbye to
            </motion.h2>
            <motion.svg initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
              width="80" height="60" viewBox="0 0 80 60" fill="none" className="hidden md:block w-16 h-12 lg:w-20 lg:h-15">
              <path d="M5 45 Q 20 10, 60 20 Q 75 25, 70 35" stroke="url(#arrowGrad)" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M65 28 L70 35 L62 38" stroke="url(#arrowGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <defs><linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#7C3AED" /></linearGradient></defs>
            </motion.svg>
          </div>
          <div className="relative h-[280px] md:h-[350px] w-full md:w-auto md:min-w-[400px] lg:min-w-[500px] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-24 z-10 pointer-events-none" style={{ background: "linear-gradient(to bottom, #F5F5F0 0%, transparent 100%)" }} />
            <div className="relative h-full flex items-center justify-center md:justify-start">
              <AnimatePresence mode="popLayout">
                {getVisibleItems().map((item) => (
                  <motion.div key={`${item.index}-${item.position}`}
                    initial={{ opacity: 0, y: (item.position + 1) * 70 }}
                    animate={{ opacity: getOpacity(item.position), y: item.position * 70 }}
                    exit={{ opacity: 0, y: (item.position - 1) * 70 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute left-0 right-0 text-center md:text-left">
                    <span className={`text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold whitespace-nowrap ${item.position === 0 ? "" : "text-gray-400"}`}
                      style={item.position === 0 ? gradientStyle : undefined}>
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-24 z-10 pointer-events-none" style={{ background: "linear-gradient(to top, #F5F5F0 0%, transparent 100%)" }} />
          </div>
        </div>
      </div>
    </section>
  );
}
