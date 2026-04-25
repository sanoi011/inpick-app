"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles, Layers, Cpu, Building2, Mail } from "lucide-react";
import Header from "@/components/landing/Header";
import LandingFooter from "@/components/landing/Footer";

const BUSINESS_AREAS = [
  {
    icon: Building2,
    tag: "주력 플랫폼",
    title: "INPICK",
    desc: "AI 기반 소비자 주도 인테리어 견적 플랫폼. 주소 입력만으로 공식 단가 기반 정확한 견적 생성.",
    status: "운영 중",
  },
  {
    icon: Layers,
    tag: "차세대 트랙",
    title: "평면도 자동 해석",
    desc: "도면 이미지 → 공간·자재·공종 자동 인식. 12K 학습 데이터 기반 비전 모델 개발.",
    status: "개발 중",
  },
  {
    icon: Cpu,
    tag: "기반 기술",
    title: "자재 매칭 AI",
    desc: "CLIP 기반 건자재 임베딩 17K건. 이미지 한 장으로 국내 유통 자재 Top-K 추천.",
    status: "내재화 완료",
  },
];

const PRINCIPLES = [
  {
    title: "실무자 설계",
    body: "8년간 건축 공무 현장에서 쌓은 견적·계약·검수 실무 문제를 직접 해결하는 방향으로 설계합니다.",
  },
  {
    title: "공공 단가 기준",
    body: "한국물가협회·LH 표준 마감사양서 등 공식 공공 단가만 채택. 민간 판매가 편향을 배제합니다.",
  },
  {
    title: "투명한 기준",
    body: "AI가 산출한 견적도 근거 단가·규격·출처를 모두 공개. 최종 선택은 사용자의 몫입니다.",
  },
];

const COMPANY_INFO = [
  { k: "회사명", v: "AIOD" },
  { k: "대표", v: "김선본" },
  { k: "플랫폼", v: "INPICK" },
  { k: "소재지", v: "대전광역시" },
  { k: "이메일", v: "tjsqhs011@naver.com" },
];

export default function AiodLandingClient() {
  const aiodNav = [
    { label: "회사 소개", href: "#about" },
    { label: "사업 영역", href: "#business" },
    { label: "원칙", href: "#principles" },
    { label: "회사 정보", href: "#contact" },
    { label: "INPICK", href: "/" },
  ];

  return (
    <>
      <Header navLinks={aiodNav} startButtonText="INPICK 체험" startButtonHref="/project/new" contactButtonText="도입 문의" contactButtonHref="#contact" />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0a0a0f] pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary-500/20 via-primary-500/10 to-transparent blur-3xl" />
          <div className="absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary-300" />
              건축·인테리어 AI 솔루션 기업
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              현장의 언어로 설계된
              <br />
              <span className="bg-gradient-to-r from-primary-300 via-primary-400 to-primary-600 bg-clip-text text-transparent">
                건축 AI
              </span>
              를 만듭니다
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              AIOD는 건축 공무 현장 8년의 실무 경험과 AI 기술을 결합해, 인테리어·건설 공사의 견적·설계·계약을 자동화합니다.
              INPICK 플랫폼이 첫 번째 답입니다.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <motion.a href="/project/new" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-gray-900">
                INPICK 무료 체험 <ArrowRight className="h-4 w-4" />
              </motion.a>
              <motion.a href="#business" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/10">
                사업 영역 보기
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-500">About AIOD</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                도메인 전문성과 기술의 교집합
              </h2>
              <p className="mt-6 text-base leading-relaxed text-gray-600">
                건축 공무 현장에서 수년간 견적서를 작성하고, 자재 단가를 비교하고, 하도급 계약을 관리했습니다.
                그 과정에서 반복되는 실수·낭비·정보 비대칭을 해결할 수 있는 유일한 방법은
                <strong className="text-gray-900"> 현장의 언어로 학습된 AI</strong> 라는 결론에 도달했습니다.
              </p>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                AIOD는 이 결론에서 출발합니다. 우리는 기술 스타트업이기 전에, 건축 실무의 문제를 가장 잘 아는 팀입니다.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-2 gap-4">
              {[
                { k: "자재 데이터", v: "17K+", sub: "국내·일본 브랜드" },
                { k: "임베딩", v: "16,900", sub: "CLIP ViT-L/14" },
                { k: "공식 단가", v: "17K+", sub: "G2B 실거래가" },
                { k: "평면도 학습셋", v: "22K+", sub: "라벨·캡션 포함" },
              ].map((stat) => (
                <div key={stat.k} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{stat.k}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.v}</p>
                  <p className="mt-1 text-xs text-gray-500">{stat.sub}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Business areas */}
      <section id="business" className="bg-gray-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-500">Business</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">사업 영역</h2>
            <p className="mt-4 text-base text-gray-600">하나의 견적 플랫폼에서 시작해, 건축 전반의 AI 자동화로 확장합니다.</p>
          </motion.div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {BUSINESS_AREAS.map((area, idx) => (
              <motion.div key={area.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-8 hover:border-primary-300 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-500 transition-colors group-hover:bg-primary-500 group-hover:text-white">
                    <area.icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{area.status}</span>
                </div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary-500">{area.tag}</p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{area.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{area.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section id="principles" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-500">Principles</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">우리가 지키는 3가지</h2>
          </motion.div>
          <div className="mt-14 grid gap-8 lg:grid-cols-3 lg:gap-10">
            {PRINCIPLES.map((p, idx) => (
              <motion.div key={p.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative rounded-2xl border-l-4 border-primary-500 bg-gray-50 p-8">
                <div className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-2 text-lg font-bold text-gray-900">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Company Info */}
      <section id="contact" className="bg-gradient-to-b from-gray-950 to-gray-900 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-300">Contact</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                파트너·도입·협업 문의
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70">
                건축사·시공사·디벨로퍼를 위한 파트너십, 자재 데이터 공유, 기업용 도입에 관한 문의는 이메일로 보내주세요.
              </p>
              <a href="mailto:tjsqhs011@naver.com"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-500">
                <Mail className="h-4 w-4" /> tjsqhs011@naver.com
              </a>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-300">회사 정보</p>
              <dl className="mt-4 flex flex-col gap-3">
                {COMPANY_INFO.map((info) => (
                  <div key={info.k} className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                    <dt className="text-sm text-white/60">{info.k}</dt>
                    <dd className="text-sm font-medium text-white">{info.v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
