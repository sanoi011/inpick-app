"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle, ChevronDown, Mail, Phone, MessageCircle,
  FileText, Shield, Info,
} from "lucide-react";

const FAQ_CATEGORIES = ["서비스", "결제", "시공", "기타"] as const;

const FAQ_DATA: { category: typeof FAQ_CATEGORIES[number]; question: string; answer: string }[] = [
  { category: "서비스", question: "INPICK은 어떤 서비스인가요?", answer: "INPICK은 AI 기반 인테리어 견적 플랫폼입니다. 아파트 도면을 분석하여 자동으로 물량을 산출하고, 검증된 시공업체와 매칭해드립니다. 대화형 AI가 인테리어 니즈를 파악하고 최적의 마감재와 스타일을 추천합니다." },
  { category: "서비스", question: "도면이 없어도 이용할 수 있나요?", answer: "네, 도면이 없어도 이용 가능합니다. 주소를 검색하면 해당 아파트의 도면을 자동으로 찾아드리며, LiDAR 스캔, 사진 촬영, 손도면 그리기 등 다양한 방법으로 도면을 생성할 수 있습니다." },
  { category: "서비스", question: "견적은 어떻게 산출되나요?", answer: "한국물가협회, 대한건설협회, 조달청 3대 공식 기관의 데이터를 기반으로 17개 공종(철거, 방수, 타일, 목공 등)별 물량을 자동 산출합니다. 직접 재료비, 노무비에 관리비(6%), 이윤(5%), 부가세(10%)를 반영한 정확한 견적을 제공합니다." },
  { category: "결제", question: "크레딧은 무엇인가요?", answer: "크레딧은 AI 이미지 생성, 3D 렌더링 등 프리미엄 기능을 이용할 때 사용됩니다. 첫 1회 무료 생성이 제공되며, 이후에는 크레딧을 충전하여 사용할 수 있습니다." },
  { category: "결제", question: "결제는 어떻게 하나요?", answer: "Toss Payments를 통해 안전하게 결제됩니다. 신용카드, 체크카드, 간편결제(토스, 카카오페이 등)를 지원합니다." },
  { category: "결제", question: "환불은 가능한가요?", answer: "미사용 크레딧은 결제일로부터 7일 이내 전액 환불 가능합니다. 부분 사용 시에는 잔여 크레딧에 대해 환불이 가능합니다. 고객센터로 문의해주세요." },
  { category: "시공", question: "시공업체는 어떻게 선정되나요?", answer: "INPICK은 사업자등록증, 건설업 면허, 포트폴리오, 고객 리뷰 등을 검증한 전문업체만 등록합니다. AI가 거리, 평점, 가격, 일정, 전문성, 신뢰도 6가지 요소를 종합 분석하여 최적의 업체를 매칭합니다." },
  { category: "시공", question: "시공 중 문제가 생기면 어떻게 하나요?", answer: "계약 체결 후 실시간 공정 관리 시스템을 통해 시공 진행 상황을 모니터링할 수 있습니다. 문제 발생 시 플랫폼 내 채팅으로 시공업체와 즉시 소통하고, 해결이 어려운 경우 INPICK 고객센터에서 중재를 지원합니다." },
  { category: "기타", question: "개인정보는 안전하게 보호되나요?", answer: "INPICK은 개인정보보호법을 준수하며, 모든 데이터는 암호화되어 저장됩니다. 개인정보는 서비스 제공 목적으로만 사용되며, 제3자에게 동의 없이 제공되지 않습니다." },
  { category: "기타", question: "모바일에서도 이용 가능한가요?", answer: "네, INPICK은 모바일 반응형으로 설계되어 스마트폰과 태블릿에서도 동일한 기능을 이용할 수 있습니다. PWA를 지원하여 홈 화면에 추가하면 앱처럼 사용할 수 있습니다." },
];

export default function MyPageSupport() {
  const [activeCategory, setActiveCategory] = useState<typeof FAQ_CATEGORIES[number]>("서비스");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFAQ = FAQ_DATA.filter((item) => item.category === activeCategory);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">고객센터</h1>
        <p className="text-sm text-gray-500">궁금한 점이 있으시면 아래에서 답변을 찾아보세요.</p>
      </div>

      {/* 연락처 카드 */}
      <div className="grid md:grid-cols-3 gap-3">
        <a href="mailto:support@inpick.kr" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Mail className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-sm font-medium text-gray-900">이메일 문의</p><p className="text-xs text-gray-500">support@inpick.kr</p></div>
        </a>
        <div className="bg-white border border-gray-200 rounded-xl p-4 opacity-60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Phone className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-sm font-medium text-gray-900">전화 상담</p><p className="text-xs text-gray-400">준비 중</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 opacity-60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-yellow-600" /></div>
          <div><p className="text-sm font-medium text-gray-900">카카오톡 문의</p><p className="text-xs text-gray-400">준비 중</p></div>
        </div>
      </div>

      {/* FAQ 아코디언 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">자주 묻는 질문</h2>
        </div>

        {/* 카테고리 탭 */}
        <div className="px-5 pt-4 flex gap-2 overflow-x-auto">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 질문 목록 */}
        <div className="divide-y divide-gray-100">
          {filteredFAQ.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 pr-4">{item.question}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openIndex === idx ? "rotate-180" : ""}`} />
              </button>
              {openIndex === idx && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 바로가기 */}
      <div className="grid md:grid-cols-3 gap-3">
        <Link href="/terms" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-3">
          <FileText className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">이용약관</span>
        </Link>
        <Link href="/privacy" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-3">
          <Shield className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">개인정보처리방침</span>
        </Link>
        <Link href="/#features" className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-3">
          <Info className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">서비스 소개</span>
        </Link>
      </div>
    </div>
  );
}
