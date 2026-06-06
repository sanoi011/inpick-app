"use client";

import { motion } from "motion/react";
import { Star, ArrowRight } from "lucide-react";
import { useRef, useEffect, useState } from "react";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 0.8;
    const handleLoaded = () => setVideoLoaded(true);
    v.addEventListener("loadeddata", handleLoaded);
    return () => v.removeEventListener("loadeddata", handleLoaded);
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-[#0a0a0f]" style={{ minHeight: "100vh" }}>
      {/* ── Video Background (전체 화면) ── */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`h-full w-full object-cover transition-opacity duration-[2000ms] ${videoLoaded ? "opacity-50" : "opacity-0"}`}
        >
          <source src="/videos/hero-interior.mp4" type="video/mp4" />
        </video>
        {/* 그라데이션 오버레이: 상단 어둡게 (텍스트 가독성) → 하단 자연스럽게 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/80 via-[#0a0a0f]/40 to-[#0a0a0f]/90" />
        {/* 좌우 비네팅 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/50 via-transparent to-[#0a0a0f]/50" />
      </div>

      {/* ── 미세한 그레인 텍스처 ── */}
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* ── Main Content ── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
        <div className="flex flex-col items-center gap-7">
          {/* 배지 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 backdrop-blur-md"
          >
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-sm font-semibold text-transparent">
              AI 기반
            </span>
            <span className="text-sm text-white/70">인테리어 견적의 새로운 기준</span>
          </motion.div>

          {/* 메인 타이틀 */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="whitespace-pre-line text-center text-4xl font-bold leading-[1.15] tracking-tight text-white md:text-5xl lg:text-[3.5rem]"
          >
            {"AI가 설계하는\n나만의 인테리어 견적."}
          </motion.h1>

          {/* 서브 카피 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-lg text-center text-base text-white/50 md:text-lg"
          >
            주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.
          </motion.p>

          {/* CTA 버튼 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-4 pt-2"
          >
            <a
              href="/project/new"
              className="group flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-semibold text-[#0a0a0f] transition-all hover:bg-white/90 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] active:scale-[0.98]"
            >
              무료 견적 시작하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          {/* 별점 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-sm text-white/40">
              실사용자 후기{" "}
              <span className="font-medium text-white/60">평점 4.9점</span>
            </span>
          </motion.div>
        </div>

        {/* 하단 스크롤 인디케이터 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-white/25">아래로 스크롤</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="h-8 w-5 rounded-full border border-white/20 p-1"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-white/40 mx-auto" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
