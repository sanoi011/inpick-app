"use client";

import { motion } from "motion/react";
import { Mail, MapPin } from "lucide-react";
import { FormEvent, useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", subject: "", email: "", phone: "", question: "" });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Contact form submitted:", formData);
  };

  const fadeUpVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

  return (
    <section className="relative w-full py-20 px-6 md:px-12 lg:px-20 bg-gray-50" id="contact">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ staggerChildren: 0.15 }} className="space-y-8">
            <motion.div variants={fadeUpVariants} transition={{ duration: 0.5 }}>
              <span className="inline-block px-4 py-2 text-sm font-medium rounded-full shadow-sm bg-white text-gray-900">문의하기</span>
            </motion.div>
            <motion.h2 variants={fadeUpVariants} transition={{ duration: 0.5 }} className="text-4xl md:text-5xl font-semibold leading-tight whitespace-pre-line text-gray-900">
              {"궁금한 점이 있다면\n편하게 말씀주세요."}
            </motion.h2>
            <motion.p variants={fadeUpVariants} transition={{ duration: 0.5 }} className="text-lg leading-relaxed whitespace-pre-line text-gray-600">
              {"견적 문의, 사업자 등록, 기술 지원 등\n무엇이든 친절히 도와드리겠습니다."}
            </motion.p>
            <motion.div variants={fadeUpVariants} transition={{ duration: 0.5 }} className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100">
                <div className="flex items-center gap-4"><Mail className="w-6 h-6 text-gray-900" /><span className="text-base font-medium text-gray-900">support@inpick.co.kr</span></div>
                <a href="mailto:support@inpick.co.kr" className="px-5 py-3 rounded-lg text-sm font-medium bg-gray-900 text-white hover:scale-105 transition-transform">메일 전송</a>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100">
                <div className="flex items-center gap-4"><MapPin className="w-6 h-6 flex-shrink-0 text-gray-900" /><span className="text-base font-medium whitespace-pre-line text-gray-900">{"서울특별시 서초구 매헌로 16,\n서울AI허브 1205호"}</span></div>
                <a href="#" className="px-5 py-3 rounded-lg text-sm font-medium bg-gray-900 text-white hover:scale-105 transition-transform flex-shrink-0">사무실 보기</a>
              </div>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="relative">
            <div className="absolute inset-0 rounded-2xl p-[2px]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              <div className="w-full h-full rounded-2xl bg-white" />
            </div>
            <form onSubmit={handleSubmit} className="relative z-10 p-8 md:p-10 space-y-6">
              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900">어떤 질문이든 환영해요</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-base font-medium text-gray-900">이름</label>
                  <input type="text" placeholder="이름을 입력해주세요" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-base outline-none bg-gray-100 text-gray-900 focus:ring-2 focus:ring-blue-500" required /></div>
                <div className="space-y-2"><label className="text-base font-medium text-gray-900">제목</label>
                  <input type="text" placeholder="제목을 입력해주세요" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-base outline-none bg-gray-100 text-gray-900 focus:ring-2 focus:ring-blue-500" required /></div>
              </div>
              <div className="space-y-2"><label className="text-base font-medium text-gray-900">이메일</label>
                <input type="email" placeholder="이메일 주소를 입력해주세요" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-base outline-none bg-gray-100 text-gray-900 focus:ring-2 focus:ring-blue-500" required /></div>
              <div className="space-y-2"><label className="text-base font-medium text-gray-900">전화번호</label>
                <input type="tel" placeholder="전화번호를 입력해주세요" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-base outline-none bg-gray-100 text-gray-900 focus:ring-2 focus:ring-blue-500" required /></div>
              <div className="space-y-2"><label className="text-base font-medium text-gray-900">질문 사항</label>
                <textarea placeholder="질문 사항을 입력해주세요" value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  rows={5} className="w-full px-4 py-3 rounded-lg text-base outline-none bg-gray-100 text-gray-900 resize-y focus:ring-2 focus:ring-blue-500" required /></div>
              <button type="submit" className="px-8 py-4 rounded-xl text-base font-medium bg-gray-900 text-white hover:scale-105 hover:shadow-lg transition-all">문의 보내기</button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
