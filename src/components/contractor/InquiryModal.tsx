"use client";

import { useState } from "react";
import { X, Loader2, Send } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface InquiryModalProps {
  contractorId: string;
  companyName: string;
  onClose: () => void;
}

const PROJECT_TYPES = [
  "아파트 전체 리모델링",
  "부분 인테리어",
  "욕실 리모델링",
  "주방 리모델링",
  "도배/장판",
  "타일 시공",
  "전기/설비",
  "기타",
];

export function InquiryModal({ contractorId, companyName, onClose }: InquiryModalProps) {
  const [form, setForm] = useState({
    consumerName: "",
    consumerPhone: "",
    consumerEmail: "",
    projectType: "",
    estimatedBudget: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.consumerName.trim() || !form.consumerPhone.trim()) {
      toast({ type: "error", title: "필수 항목", message: "이름과 연락처를 입력해주세요" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractors/${contractorId}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast({ type: "success", title: "문의 완료", message: `${companyName}에 문의가 전송되었습니다` });
        onClose();
      } else {
        const data = await res.json();
        toast({ type: "error", title: "전송 실패", message: data.error || "다시 시도해주세요" });
      }
    } catch {
      toast({ type: "error", title: "오류", message: "네트워크 오류가 발생했습니다" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">견적 요청</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{companyName}</span>에 견적을 요청합니다
          </p>

          {/* 이름 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.consumerName}
              onChange={(e) => setForm({ ...form, consumerName: e.target.value })}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.consumerPhone}
              onChange={(e) => setForm({ ...form, consumerPhone: e.target.value })}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={form.consumerEmail}
              onChange={(e) => setForm({ ...form, consumerEmail: e.target.value })}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 공사 유형 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">공사 유형</label>
            <select
              value={form.projectType}
              onChange={(e) => setForm({ ...form, projectType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택해주세요</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 예산 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">예상 예산</label>
            <select
              value={form.estimatedBudget}
              onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택해주세요</option>
              <option value="1000만원 이하">1,000만원 이하</option>
              <option value="1000~3000만원">1,000~3,000만원</option>
              <option value="3000~5000만원">3,000~5,000만원</option>
              <option value="5000만원~1억">5,000만원~1억</option>
              <option value="1억 이상">1억 이상</option>
            </select>
          </div>

          {/* 메시지 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">요청 사항</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="시공 내용이나 요청 사항을 적어주세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 제출 */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? "전송중..." : "견적 요청 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
