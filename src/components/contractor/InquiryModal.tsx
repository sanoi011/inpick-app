"use client";

import { useState } from "react";
import { Check, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { canSubmitContractorInquiry } from "@/lib/contractor-experience";

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

const BUDGET_OPTIONS = [
  ["1000만원 이하", "1,000만원 이하"],
  ["1000~3000만원", "1,000~3,000만원"],
  ["3000~5000만원", "3,000~5,000만원"],
  ["5000만원~1억", "5,000만원~1억"],
  ["1억 이상", "1억 이상"],
] as const;

const INPUT_CLASS = "w-full rounded-xl border border-black/[0.09] bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-black/35 focus:ring-2 focus:ring-black/[0.04]";
const CONSENT_VERSION = "contractor-inquiry-v1";

export function InquiryModal({ contractorId, companyName, onClose }: InquiryModalProps) {
  const [form, setForm] = useState({
    consumerName: "",
    consumerPhone: "",
    consumerEmail: "",
    projectType: "",
    estimatedBudget: "",
    message: "",
  });
  const [sharingAccepted, setSharingAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = canSubmitContractorInquiry({
    consumerName: form.consumerName,
    consumerPhone: form.consumerPhone,
    sharingAccepted,
  });

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        type: "error",
        title: "필수 확인",
        message: "이름·연락처를 입력하고 정보 공유를 확인해주세요",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/contractors/${contractorId}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sharingAccepted, consentVersion: CONSENT_VERSION }),
      });
      if (response.ok) {
        toast({ type: "success", title: "문의 완료", message: `${companyName}에 문의가 전송되었습니다` });
        onClose();
        return;
      }
      const data = await response.json();
      toast({ type: "error", title: "전송 실패", message: data.error || "다시 시도해주세요" });
    } catch {
      toast({ type: "error", title: "오류", message: "네트워크 오류가 발생했습니다" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-[#f15b4a]">DIRECT REQUEST</p>
            <h3 className="mt-1 text-lg font-black text-gray-900">1:1 견적 문의</h3>
          </div>
          <button type="button" aria-label="문의 닫기" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f3] text-black/45 transition hover:bg-black hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="text-sm leading-6 text-black/50">
            <strong className="text-black">{companyName}</strong> 한 곳에 프로젝트 문의를 보냅니다.
          </p>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f7f7f5] p-3 text-center">
            {["요청 작성", "업체 확인", "연락·협의"].map((label, index) => (
              <div key={label}>
                <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${index === 0 ? "bg-black text-white" : "bg-white text-black/40"}`}>
                  {index + 1}
                </span>
                <p className="mt-1.5 text-[10px] font-bold text-black/50">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이름" required>
              <input value={form.consumerName} onChange={(event) => setForm({ ...form, consumerName: event.target.value })} placeholder="이름 입력" className={INPUT_CLASS} />
            </Field>
            <Field label="연락처" required>
              <input type="tel" value={form.consumerPhone} onChange={(event) => setForm({ ...form, consumerPhone: event.target.value })} placeholder="010-0000-0000" className={INPUT_CLASS} />
            </Field>
          </div>

          <Field label="이메일">
            <input type="email" value={form.consumerEmail} onChange={(event) => setForm({ ...form, consumerEmail: event.target.value })} placeholder="email@example.com" className={INPUT_CLASS} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="공사 유형">
              <select value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })} className={INPUT_CLASS}>
                <option value="">선택</option>
                {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="예상 예산">
              <select value={form.estimatedBudget} onChange={(event) => setForm({ ...form, estimatedBudget: event.target.value })} className={INPUT_CLASS}>
                <option value="">선택</option>
                {BUDGET_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="요청 사항">
            <textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="시공 범위, 희망 일정, 꼭 지켜야 할 조건을 적어주세요" rows={4} className={`${INPUT_CLASS} resize-none`} />
          </Field>

          <button
            type="button"
            role="checkbox"
            aria-checked={sharingAccepted}
            onClick={() => setSharingAccepted((accepted) => !accepted)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${sharingAccepted ? "border-black bg-black text-white" : "border-black/[0.09] bg-white hover:border-black/25"}`}
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${sharingAccepted ? "border-white bg-white text-black" : "border-black/20"}`}>
              {sharingAccepted && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-xs font-black"><ShieldCheck className="h-3.5 w-3.5" /> 이 업체에 정보 공유 확인</span>
              <span className={`mt-1 block text-[11px] leading-5 ${sharingAccepted ? "text-white/65" : "text-black/45"}`}>
                이름, 연락처, 선택한 공사 유형·예산, 요청 사항이 {companyName} 한 곳에 전달됩니다. 상세 주소는 자동 전달되지 않습니다.
              </span>
            </span>
          </button>
        </div>

        <div className="sticky bottom-0 border-t border-black/[0.06] bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-bold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/35"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "전송 중" : "확인하고 문의 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-black/65">
        {label}{required && <span className="ml-1 text-[#e34c3b]">*</span>}
      </span>
      {children}
    </label>
  );
}
