"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CreditCard, Calendar, Check } from "lucide-react";

const PLANS = [
  {
    id: "basic", name: "베이직", description: "처음 인테리어 견적을\n받아보는 소비자",
    discount: "무료", price: "0원", period: "", buttonText: "무료로 시작하기",
    isHighlighted: false,
    features: ["AI 상담 1회 체험", "기본 견적서 생성", "공간 1개 견적", "실시간 단가 조회"],
  },
  {
    id: "standard", name: "스탠다드", description: "본격적인 인테리어를\n계획하는 소비자",
    discount: "인기", price: "49,000원", period: "/ 건", buttonText: "견적 시작하기",
    isHighlighted: true,
    features: ["AI 상담 무제한", "전체 공간 견적서", "3D 뷰어 연동", "전문업체 매칭 3곳", "견적 비교 리포트"],
  },
  {
    id: "pro", name: "프로 (사업자)", description: "인테리어 사업을 운영하는\n전문 시공업체",
    discount: "B2B", price: "월 99,000원", period: "/ 월", buttonText: "사업자 등록하기",
    isHighlighted: false,
    features: ["입찰 참여 무제한", "AI 비서 기능", "전문업체 협업 매칭", "일정/재무 관리", "포트폴리오 등록"],
  },
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="relative w-full py-16 px-4 sm:py-20 md:py-24" style={{ backgroundColor: "#f4f2f1" }}>
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex justify-center mb-6">
          <span className="px-4 py-2 rounded-full text-sm font-medium shadow-sm bg-white text-gray-900">이용 요금</span>
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900">가장 합리적인 요금제.</motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
          className="text-center text-base sm:text-lg mb-10 text-gray-600">소비자와 사업자 모두를 위한 맞춤 요금제</motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
          className="flex justify-center items-center gap-4 mb-12">
          <span className="text-base font-medium text-gray-900">월별 결제</span>
          <button onClick={() => setIsAnnual(!isAnnual)} className="relative w-14 h-7 rounded-full transition-colors duration-300 bg-gray-900">
            <motion.div className="absolute top-1 w-5 h-5 rounded-full shadow-md bg-white"
              animate={{ left: isAnnual ? "calc(100% - 24px)" : "4px" }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </button>
          <span className={`text-base ${isAnnual ? "text-gray-900" : "text-gray-400"}`}>연간 결제</span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {PLANS.map((plan, index) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }} className="relative rounded-[20px] overflow-hidden h-full">
              <div className="rounded-2xl shadow-lg h-full flex flex-col bg-white" style={{ boxShadow: "0 1px 1px rgba(0,0,0,0.2), 0 3px 8px rgba(0,0,0,0.05)" }}>
                <div className="p-6 pb-8">
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{plan.name}</h3>
                  <p className="text-sm whitespace-pre-line mb-3 leading-relaxed text-gray-600">{plan.description}</p>
                  <div className="inline-block px-3 py-1.5 rounded-full text-sm font-medium mb-4" style={{
                    backgroundColor: plan.isHighlighted ? "#2563EB" : "#F3F4F6",
                    color: plan.isHighlighted ? "#FFFFFF" : "#374151",
                  }}>{plan.discount}</div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-base text-gray-600">{plan.period}</span>}
                  </div>
                  <a href={plan.id === "pro" ? "/contractor/register" : "/project/new"}
                    className="block w-full py-4 px-6 rounded-lg text-base font-medium transition-colors duration-200 bg-gray-900 text-white hover:bg-gray-800 text-center">
                    {plan.buttonText}
                  </a>
                </div>
                <div className="px-6 py-6 flex-1 mb-1 bg-gray-50">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-blue-600">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                        <span className="text-base font-medium leading-relaxed text-gray-800">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="h-2 rounded-b-[20px] -mt-1" style={{
                background: plan.isHighlighted ? "linear-gradient(90deg, #2563EB, #3B82F6, #7C3AED, #EC4899)" : "#E5E7EB",
              }} />
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center items-center gap-6 text-base">
          <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-gray-900" /><span className="text-gray-900">신용카드 등록 없이</span></div>
          <div className="w-1 h-1 rounded-full bg-gray-300" />
          <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-gray-900" /><span className="text-gray-900">첫 가입 시, 무료 1회 견적 제공</span></div>
        </motion.div>
      </div>
    </section>
  );
}
