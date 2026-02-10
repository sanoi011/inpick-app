"use client";

import { motion } from "motion/react";
import { FolderOpen, UserPlus, Timer, Tag } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const FEATURES = [
  { icon: "folder", title: "피그마 도면 연동", description: "도면을 업로드하면 자동으로 공간을 분석합니다" },
  { icon: "user-plus", title: "전문업체 자동 매칭", description: "AI가 최적의 전문업체를 6가지 기준으로 매칭" },
  { icon: "timer", title: "실시간 단가 갱신", description: "3대 공식 기관 데이터를 자동 크롤링" },
  { icon: "tag", title: "22개 공종 자동 분류", description: "견적 항목별 공종 자동 배분 및 관리" },
] as const;

const TAGS = [
  { label: "AI 상담 견적", color: "#2563EB" },
  { label: "3D 실시간 뷰어", color: "#7C3AED" },
  { label: "선행공정 자동매핑", color: "#EC4899" },
  { label: "공식 단가 연동", color: "#059669" },
  { label: "전문업체 매칭", color: "#D97706" },
  { label: "도면 자동 분석", color: "#2563EB" },
  { label: "견적서 PDF 출력", color: "#7C3AED" },
];

const iconMap = { folder: FolderOpen, "user-plus": UserPlus, timer: Timer, tag: Tag } as const;

function MarqueeTags() {
  const [offset, setOffset] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const animate = () => {
      setOffset((prev) => (prev + 0.5 >= 1072 ? 0 : prev + 0.5));
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  const allTags = [...TAGS, ...TAGS, ...TAGS];

  return (
    <div className="relative w-full overflow-hidden" style={{
      maskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgb(0,0,0) 80%, rgba(0,0,0,0) 100%)",
      WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgb(0,0,0) 80%, rgba(0,0,0,0) 100%)",
    }}>
      <div className="flex gap-2.5" style={{ transform: `translateX(-${offset}px)`, width: "max-content" }}>
        {allTags.map((tag, index) => (
          <div key={index} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[10px] shrink-0 bg-gray-800">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
            <span className="text-sm whitespace-nowrap text-white">{tag.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeaturesDark() {
  return (
    <section className="relative w-full py-16 md:py-24 overflow-hidden bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center justify-center mb-6">
            <div className="px-4 py-2 rounded-full text-sm text-white border border-white/10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" }}>
              INPICK 한눈에 보기
            </div>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-white">소비자 주도<br />인테리어 견적 플랫폼.</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="text-base md:text-lg mb-8 max-w-2xl mx-auto text-gray-300">AI 상담, 실시간 단가, 3D 뷰어, 전문업체 매칭까지 하나의 플랫폼에서</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
            <a href="/address" className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-medium bg-white text-gray-900 hover:opacity-90 hover:scale-105 transition-all">
              무료 견적 시작하기
            </a>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-xl overflow-hidden mb-12 border border-white/10">
          {FEATURES.map((feature, index) => {
            const IconComponent = iconMap[feature.icon];
            return (
              <div key={feature.title} className="p-6 relative" style={{ borderRight: index < 3 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                <div className="flex flex-col gap-4">
                  <div className="w-6 h-6 text-white">{IconComponent && <IconComponent className="w-6 h-6" />}</div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-medium text-white">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-4 mb-8">
          <div className="flex-1 h-px max-w-[200px]" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1))" }} />
          <div className="px-4 py-2 rounded-full text-sm whitespace-nowrap text-white border border-white/10">핵심 기술 키워드</div>
          <div className="flex-1 h-px max-w-[200px]" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.1))" }} />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.7 }}>
          <MarqueeTags />
        </motion.div>
      </div>
    </section>
  );
}
