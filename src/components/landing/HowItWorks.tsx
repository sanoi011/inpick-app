"use client";

import { motion } from "motion/react";
import { MapPin, MessageSquare, Ruler, FileText } from "lucide-react";

const STEPS = [
  {
    icon: MapPin,
    step: "01",
    title: "주소 입력",
    description: "우리집 주소만 입력하면\n건물 정보를 자동으로 불러옵니다",
    color: "#2563EB",
  },
  {
    icon: MessageSquare,
    step: "02",
    title: "AI 디자인 상담",
    description: "AI와 대화하며 원하는\n인테리어 스타일을 정합니다",
    color: "#7C3AED",
  },
  {
    icon: Ruler,
    step: "03",
    title: "자동 물량 산출",
    description: "17개 공종, 공식 단가 기반\n정밀 견적서가 자동 생성됩니다",
    color: "#059669",
  },
  {
    icon: FileText,
    step: "04",
    title: "전문업체 매칭",
    description: "검증된 시공업체를\nAI가 자동으로 매칭합니다",
    color: "#D97706",
  },
];

export default function HowItWorks() {
  return (
    <section className="w-full py-16 md:py-24" style={{ backgroundColor: "#f4f2f1" }}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-4 py-2 mb-6 rounded-full text-sm font-medium bg-white text-gray-900 shadow-sm">
            이용 방법
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
            4단계로 끝나는 인테리어 견적
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <Icon className="w-6 h-6" style={{ color: step.color }} />
                </div>
                <div className="text-xs font-bold mb-2" style={{ color: step.color }}>
                  STEP {step.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {step.description}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-6 text-gray-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
