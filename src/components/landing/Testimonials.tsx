"use client";

import { motion } from "motion/react";

const STAT_CARDS = [
  { stat: "10X", label: "견적 비용 절감", company: "vs 기존 외주", bgColor: "#EFF6FF", borderColor: "#BFDBFE" },
  { stat: "5분", label: "견적 생성 시간", company: "AI 자동 산출", bgColor: "#F0FDF4", borderColor: "#BBF7D0" },
  { stat: "99%", label: "단가 정확도", company: "공식 데이터 기반", bgColor: "#EFF6FF", borderColor: "#BFDBFE" },
  { stat: "22개", label: "공종 자동 분류", company: "선행공정 매핑", bgColor: "#FEF2F2", borderColor: "#FECACA" },
];

const TESTIMONIALS = [
  { quote: '"인테리어 견적을 받을 때마다 업체마다 가격이 달라 불안했는데, INPICK은 공식 단가 기반이라 신뢰가 갑니다."', name: "김민수", role: "30평대 아파트 리모델링 고객" },
  { quote: '"AI 상담으로 제가 원하는 스타일을 설명하니까, 바로 견적에 반영되고 3D로 볼 수 있어서 놀랐어요."', name: "이서연", role: "신혼집 인테리어 고객" },
  { quote: '"선행공정을 자동으로 잡아주니까 나중에 추가 비용 걱정이 없어요. 진짜 투명한 견적이네요."', name: "박준혁", role: "상가 인테리어 사업주" },
  { quote: '"사업자 AI 비서 기능 덕분에 일정 관리와 전문업체 매칭이 한결 수월해졌습니다."', name: "정다은", role: "인테리어 시공업체 대표" },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } } };

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative w-full py-16 md:py-24 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-12 flex flex-col items-center text-center">
          <span className="mb-6 inline-flex rounded-full px-3 py-1.5 text-sm font-medium bg-white text-gray-900 shadow-sm">실제 이용 후기</span>
          <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl text-gray-900">
            먼저 사용해본<br />사용자들의 생생한 후기.
          </h2>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-4 md:grid-cols-3">
          {STAT_CARDS.slice(0, 2).map((card, i) => (
            <motion.div key={i} variants={itemVariants}>
              <div className="flex h-full min-h-[200px] flex-col justify-between rounded-xl p-6" style={{ backgroundColor: card.bgColor, border: `1px solid ${card.borderColor}` }}>
                <div><p className="text-4xl font-semibold md:text-5xl text-gray-900">{card.stat}</p><p className="mt-1 text-base text-gray-600">{card.label}</p></div>
                <p className="mt-4 text-xl font-bold tracking-tight md:text-2xl text-gray-900">{card.company}</p>
              </div>
            </motion.div>
          ))}
          <motion.div variants={itemVariants}>
            <div className="flex h-full min-h-[200px] flex-col justify-between rounded-xl p-6 bg-white border border-gray-200">
              <p className="text-base leading-relaxed md:text-lg text-gray-800">{TESTIMONIALS[0].quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-bold">{TESTIMONIALS[0].name[0]}</span></div>
                <div><p className="text-sm font-semibold text-gray-900">{TESTIMONIALS[0].name}</p><p className="text-sm text-gray-600">{TESTIMONIALS[0].role}</p></div>
              </div>
            </div>
          </motion.div>

          {TESTIMONIALS.slice(1, 3).map((t, i) => (
            <motion.div key={i} variants={itemVariants} className={i === 1 ? "md:col-span-2" : ""}>
              <div className="flex h-full min-h-[200px] flex-col justify-between rounded-xl p-6 bg-white border border-gray-200">
                <p className="text-base leading-relaxed md:text-lg text-gray-800">{t.quote}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-bold">{t.name[0]}</span></div>
                  <div><p className="text-sm font-semibold text-gray-900">{t.name}</p><p className="text-sm text-gray-600">{t.role}</p></div>
                </div>
              </div>
            </motion.div>
          ))}

          {STAT_CARDS.slice(2).map((card, i) => (
            <motion.div key={i} variants={itemVariants}>
              <div className="flex h-full min-h-[200px] flex-col justify-between rounded-xl p-6" style={{ backgroundColor: card.bgColor, border: `1px solid ${card.borderColor}` }}>
                <div><p className="text-4xl font-semibold md:text-5xl text-gray-900">{card.stat}</p><p className="mt-1 text-base text-gray-600">{card.label}</p></div>
                <p className="mt-4 text-xl font-bold tracking-tight md:text-2xl text-gray-900">{card.company}</p>
              </div>
            </motion.div>
          ))}
          <motion.div variants={itemVariants}>
            <div className="flex h-full min-h-[200px] flex-col justify-between rounded-xl p-6 bg-white border border-gray-200">
              <p className="text-base leading-relaxed md:text-lg text-gray-800">{TESTIMONIALS[3].quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-bold">{TESTIMONIALS[3].name[0]}</span></div>
                <div><p className="text-sm font-semibold text-gray-900">{TESTIMONIALS[3].name}</p><p className="text-sm text-gray-600">{TESTIMONIALS[3].role}</p></div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
