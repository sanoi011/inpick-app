"use client";

import { motion } from "motion/react";

const HOME_LINKS = [
  { label: "서비스 소개", href: "#features" },
  { label: "이용 요금", href: "#pricing" },
  { label: "이용 후기", href: "#testimonials" },
  { label: "자주 묻는 질문", href: "#faq" },
];

const COMPANY_INFO = {
  copyright: "Copyright © 2026 주식회사 아이오드 (AIOD). All rights reserved.",
  ceo: "운영사: 주식회사 아이오드 (AIOD) | 서비스명: INPICK",
  businessNumber: "사업자등록번호: 384-81-04107",
  phone: "대표: 김선본",
  address: "소재지: 대전광역시 유성구 대덕512번길20, 대전정보문화산업진흥원 B동 2층 1인창조기업지원센터",
  email: "이메일: lookingseon@aiod.kr",
};

const LEGAL_LINKS = [
  { label: "개인정보처리방침", href: "/privacy" },
  { label: "이용약관", href: "/terms" },
];

export default function LandingFooter() {
  return (
    <footer className="w-full bg-gray-950">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col gap-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
            <div className="flex flex-col gap-3">
              <a href="/" className="text-2xl font-bold text-blue-500">INPICK</a>
              <p className="text-sm text-gray-400">AI 기반 소비자 주도 인테리어 견적 플랫폼</p>
            </div>
            <div className="flex flex-col gap-10 sm:flex-row sm:gap-20">
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium text-white">서비스</p>
                <div className="flex flex-col gap-3">
                  {HOME_LINKS.map((link) => (
                    <a key={link.label} href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">{link.label}</a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium text-white">바로가기</p>
                <div className="flex flex-col gap-3">
                  <a href="/project/new" className="text-sm text-gray-400 hover:text-white transition-colors">프로젝트 시작</a>
                  <a href="/contractor/register" className="text-sm text-gray-400 hover:text-white transition-colors">사업자 등록</a>
                  <a href="/find-contractors" className="text-sm text-gray-400 hover:text-white transition-colors">업체 찾기</a>
                  <a href="/community" className="text-sm text-gray-400 hover:text-white transition-colors">커뮤니티</a>
                  <a href="/contractor/login" className="text-sm text-gray-400 hover:text-white transition-colors">사업자 로그인</a>
                  <a href="/aiod" className="text-sm text-gray-400 hover:text-white transition-colors">AIOD 소개</a>
                  <a href="#contact" className="text-sm text-gray-400 hover:text-white transition-colors">문의하기</a>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6 pt-8 lg:flex-row lg:justify-between lg:items-start border-t border-gray-800">
            <div className="text-sm leading-relaxed text-gray-400">
              <p>{COMPANY_INFO.copyright}</p>
              <p>{COMPANY_INFO.businessNumber}</p>
              <p>{COMPANY_INFO.ceo}</p>
              <p>{COMPANY_INFO.email}</p>
              <p>{COMPANY_INFO.phone}</p>
              <p>{COMPANY_INFO.address}</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {LEGAL_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">{link.label}</a>
              ))}
              <a href="/admin" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">관리자</a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

export { LandingFooter as Footer };
