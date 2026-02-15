"use client";

import { motion } from "motion/react";
import { Check, GitBranch, Star } from "lucide-react";
import {
  AIConsultAnimation,
  PriceSyncAnimation,
  EstimateViewerAnimation,
  ContractorMatchAnimation,
} from "./FeatureAnimations";

const FEATURES = [
  {
    label: "AI 인테리어 상담",
    title: "대화만으로",
    titleBreak: "견적이 완성됩니다.",
    description: "AI가 고객의 인테리어 니즈를 파악하고, 최적의 마감재와 스타일을 추천합니다",
    animation: "ai-consult" as const,
    checkItems: [
      "대화형 AI가 인테리어 니즈 파악",
      "실시간 단가 기반 견적 자동 생성",
      "선행공정 자동 매핑으로 누락 방지",
    ],
  },
  {
    label: "실시간 단가 연동",
    title: "공식 기관 데이터로,",
    titleBreak: "정확한 견적을.",
    description: "한국물가협회, 대한건설협회, 조달청 3대 공식 데이터를 자동 연동합니다.",
    animation: "price-sync" as const,
    subFeatures: [
      { icon: "branch" as const, title: "자재 단가 실시간 반영", description: "한국물가협회 데이터를 매월 자동 갱신하여 최신 자재 단가를 적용합니다" },
      { icon: "star" as const, title: "노임 단가 공식 기준", description: "대한건설협회 공시 노임단가를 기준으로 정확한 인건비를 산출합니다" },
    ],
  },
  {
    label: "3D 견적 뷰어",
    title: "내 공간을 3D로 보면서",
    titleBreak: "견적을 확인하세요.",
    description: "견적 항목과 3D 공간이 실시간 연동됩니다.",
    descriptionBreak: "마감재를 선택하면 3D 뷰어에서 바로 확인할 수 있어요.",
    animation: "estimate-viewer" as const,
  },
  {
    label: "전문업체 매칭",
    title: "검증된 전문업체,",
    titleBreak: "자동으로 매칭.",
    description: "AI가 견적 내용을 분석하여 최적의 전문업체를 자동 매칭합니다.",
    descriptionBreak: "거리, 평점, 가격, 일정 등 6가지 요소를 종합 분석합니다.",
    animation: "contractor-match" as const,
  },
];

type AnimationType = "ai-consult" | "price-sync" | "estimate-viewer" | "contractor-match";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium bg-white text-gray-900" style={{ boxShadow: "0 1px 1px rgba(0,0,0,0.1)" }}>
      {children}
    </span>
  );
}

function GradientCheckIcon() {
  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)", boxShadow: "0 6px 12px rgba(37,99,235,0.3)" }}>
      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
    </div>
  );
}

function AnimationVisual({ type }: { type: AnimationType }) {
  switch (type) {
    case "ai-consult":
      return <AIConsultAnimation />;
    case "price-sync":
      return <PriceSyncAnimation />;
    case "estimate-viewer":
      return <EstimateViewerAnimation />;
    case "contractor-match":
      return <ContractorMatchAnimation />;
  }
}

function FeatureSection({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const isReversed = index % 2 === 1;

  const content = (
    <div className="flex flex-col justify-center space-y-6">
      <Badge>{feature.label}</Badge>
      <h2 className="text-3xl font-bold leading-tight lg:text-4xl text-gray-900">
        {feature.title}<br />{feature.titleBreak}
      </h2>
      <p className="text-gray-600">
        {feature.description}
        {feature.descriptionBreak && <><br />{feature.descriptionBreak}</>}
      </p>
      {feature.checkItems && (
        <div className="space-y-3">
          {feature.checkItems.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }} viewport={{ once: true }} className="flex items-center gap-3">
              <GradientCheckIcon />
              <span className="text-gray-600">{item}</span>
            </motion.div>
          ))}
        </div>
      )}
      {feature.subFeatures && (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          {feature.subFeatures.map((sub, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.15 }} viewport={{ once: true }} className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {sub.icon === "branch" ? <GitBranch className="h-5 w-5 text-blue-600" /> : <Star className="h-5 w-5 text-indigo-600" />}
                <span className="font-semibold text-gray-900">{sub.title}</span>
              </div>
              <p className="text-sm text-gray-600">{sub.description}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const visual = (
    <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <AnimationVisual type={feature.animation} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}
      className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {isReversed ? <>{content}{visual}</> : <>{visual}{content}</>}
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="features" className="w-full py-16 lg:py-24" style={{ backgroundColor: "#F5F5F5" }}>
      <div className="mx-auto max-w-6xl space-y-20 px-6 lg:space-y-32 lg:px-8">
        {FEATURES.map((feature, index) => (
          <FeatureSection key={feature.label} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
