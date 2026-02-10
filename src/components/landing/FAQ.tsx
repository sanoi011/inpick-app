"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";

const FAQ_DATA = {
  leftColumn: [
    { question: "INPICK은 어떤 서비스인가요?", answer: "INPICK은 AI 기반 인테리어 견적 플랫폼입니다. 주소만 입력하면 AI가 실시간 공식 단가를 기반으로 정확한 견적을 생성합니다." },
    { question: "견적 비용은 어떻게 산출되나요?", answer: "한국물가협회(자재단가), 대한건설협회(노임단가), 조달청(간접비율) 3대 공식 기관의 데이터를 실시간으로 연동하여 산출합니다." },
    { question: "선행공정이 뭔가요?", answer: "마감재를 시공하기 전에 반드시 필요한 사전 공정입니다. 예를 들어 타일 시공 전 방수 처리가 필요합니다. INPICK은 이를 자동으로 매핑하여 누락을 방지합니다." },
    { question: "AI 상담은 어떻게 진행되나요?", answer: "채팅 형태로 AI와 대화하며 인테리어 니즈를 전달하면, AI가 적합한 마감재와 시공법을 추천하고 실시간으로 견적에 반영합니다." },
    { question: "3D 뷰어는 어떤 기능인가요?", answer: "도면 기반으로 생성된 3D 공간에서 마감재 선택 결과를 실시간으로 확인할 수 있습니다. 견적 항목을 클릭하면 해당 부위가 3D에서 하이라이트됩니다." },
  ],
  rightColumn: [
    { question: "사업자도 이용할 수 있나요?", answer: "네, INPICK은 B2B 기능도 제공합니다. 사업자 등록 후 입찰 참여, AI 비서, 전문업체 매칭 등의 기능을 이용할 수 있습니다." },
    { question: "전문업체 매칭은 어떻게 되나요?", answer: "AI가 거리, 평점, 가격, 일정, 경력, 신뢰도 6가지 요소를 분석하여 최적의 전문업체를 자동 매칭합니다." },
    { question: "견적서를 PDF로 받을 수 있나요?", answer: "네, 완성된 견적서를 PDF로 다운로드하여 업체에 전달하거나 보관할 수 있습니다." },
    { question: "단가 정보는 얼마나 자주 업데이트되나요?", answer: "자재 단가는 매월, 노임 단가는 반기별, 간접비율은 매년 공식 기관 데이터를 자동 크롤링하여 갱신합니다." },
    { question: "견적 수정이 가능한가요?", answer: "물론입니다. 생성된 견적은 자유롭게 수정할 수 있으며, 수정 시 선행공정과 부자재도 자동으로 재계산됩니다." },
  ],
};

function AccordionItem({ item, isOpen, onClick }: { item: { question: string; answer: string }; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-t border-gray-200 cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between py-5 px-1">
        <h5 className="text-base font-medium text-left pr-4 text-gray-900">{item.question}</h5>
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-900">
          {isOpen ? <Minus size={18} /> : <Plus size={18} />}
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <p className="pb-5 px-1 text-sm leading-relaxed text-gray-500">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const toggleItem = (id: string) => {
    setOpenItems((prev) => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });
  };

  return (
    <section id="faq" className="relative w-full py-20 px-4 md:px-8" style={{ backgroundColor: "#F1F0EE" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div className="flex flex-col items-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="px-3 py-2 rounded-full mb-4 bg-white shadow-sm"><span className="text-sm font-medium text-gray-900">FAQs</span></div>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900">자주 묻는 질문</h2>
        </motion.div>
        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-0 mb-16" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div>{FAQ_DATA.leftColumn.map((item, i) => (<AccordionItem key={`l-${i}`} item={item} isOpen={openItems.has(`l-${i}`)} onClick={() => toggleItem(`l-${i}`)} />))}</div>
          <div>{FAQ_DATA.rightColumn.map((item, i) => (<AccordionItem key={`r-${i}`} item={item} isOpen={openItems.has(`r-${i}`)} onClick={() => toggleItem(`r-${i}`)} />))}</div>
        </motion.div>
        <motion.div className="rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div>
            <h5 className="text-base md:text-lg font-semibold mb-1 text-gray-900">궁금한 점이 있으신가요?</h5>
            <p className="text-sm text-gray-500">문의사항이 있으시면 언제든지 연락해주세요.</p>
          </div>
          <a href="#contact" className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-medium bg-gray-900 text-white hover:opacity-90">문의하기</a>
        </motion.div>
      </div>
    </section>
  );
}
