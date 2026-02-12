"use client";

const COLORS = {
  background: "#f4f2f1",
  gradient: "#f2f0ee",
  text: "#111111",
  textMuted: "#3D3D3D",
  buttonBg: "#2563EB",
  buttonText: "#FFFFFF",
  reviewText: "#4C4C4C",
} as const;

const GRADIENT = {
  badge: "linear-gradient(90deg, #2563EB 0%, #7C3AED 50%, #EC4899 100%)",
} as const;

import { motion } from "motion/react";
import { Star } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden pt-32" style={{ paddingBottom: "100px", backgroundColor: COLORS.background }}>
      {/* Background Effects */}
      <div className="pointer-events-none absolute overflow-visible" style={{ backgroundColor: COLORS.background, height: "1024px", top: 0, left: "-120px", right: "-120px", zIndex: 1, WebkitMask: "linear-gradient(#000 63%, #0000 100%)", mask: "linear-gradient(#000 63%, #0000 100%)" }}>
        <div className="absolute" style={{ filter: "blur(2px)", width: "378px", height: "571px", top: 0, left: 0 }}>
          <div className="absolute" style={{ width: "420px", height: "571px", top: 0, left: "-42px" }}>
            <div className="absolute rounded-full" style={{ backgroundColor: "#2563EB", width: "207px", height: "208px", filter: "blur(200px)", top: "207px", left: 0 }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#7C3AED", width: "207px", height: "208px", filter: "blur(200px)", top: "363px", left: "37px" }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#3B82F6", width: "207px", height: "207px", filter: "blur(200px)", top: 0, left: "213px" }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#1D4ED8", width: "207px", height: "208px", filter: "blur(200px)", top: "80px", left: "9px" }} />
          </div>
        </div>
        <div className="absolute" style={{ filter: "blur(2px)", width: "378px", height: "571px", top: 0, right: 0, transform: "rotate(180deg)" }}>
          <div className="absolute" style={{ width: "420px", height: "571px", top: 0, left: "-42px" }}>
            <div className="absolute rounded-full" style={{ backgroundColor: "#2563EB", width: "207px", height: "208px", filter: "blur(200px)", top: "207px", left: 0 }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#7C3AED", width: "207px", height: "208px", filter: "blur(200px)", top: "363px", left: "37px" }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#3B82F6", width: "207px", height: "207px", filter: "blur(200px)", top: 0, left: "213px" }} />
            <div className="absolute rounded-full" style={{ backgroundColor: "#1D4ED8", width: "207px", height: "208px", filter: "blur(200px)", top: "80px", left: "9px" }} />
          </div>
        </div>
        <div className="absolute left-0 right-0 top-0" style={{ background: `linear-gradient(${COLORS.gradient} 0%, ${COLORS.gradient}00 100%)`, height: "415px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <div className="flex flex-col items-center gap-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-2 backdrop-blur-sm">
            <span className="text-sm font-semibold" style={{ background: GRADIENT.badge, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              AI 기반
            </span>
            <span className="text-sm" style={{ color: COLORS.text }}>인테리어 견적의 새로운 기준</span>
          </motion.div>

          <div className="flex flex-col items-center gap-4">
            <motion.h1 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
              className="whitespace-pre-line text-center text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl" style={{ color: COLORS.text }}>
              {"AI가 설계하는\n나만의 인테리어 견적."}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-xl text-center text-base md:text-lg" style={{ color: COLORS.textMuted }}>
              주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.
            </motion.p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <motion.a initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
              href="/project/new" className="rounded-lg px-6 py-4 text-base font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: COLORS.buttonBg, color: COLORS.buttonText }}>
              무료 견적 시작하기
            </motion.a>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />))}
              </div>
              <span className="text-sm" style={{ color: COLORS.reviewText }}>
                <span className="opacity-70">실사용자 후기 </span>
                <span className="font-medium" style={{ color: COLORS.text }}>평점 4.9점</span>
              </span>
            </motion.div>
          </div>

          {/* Preview Card */}
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.5 }}
            className="relative mt-8 w-full max-w-5xl">
            <div className="relative rounded-2xl p-[3px]" style={{ background: "linear-gradient(179deg, #2563EB 0%, #3B82F6 36%, #7C3AED 70%, #EC4899 100%)" }}>
              <div className="relative overflow-hidden rounded-[13px] bg-white">
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src="/images/hero-kitchen.jpg"
                    alt="AI 인테리어 견적 데모 - 럭셔리 주방 인테리어"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
