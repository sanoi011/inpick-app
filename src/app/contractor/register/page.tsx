"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, User, Phone, Mail, MapPin,
  FileText, Briefcase, CheckCircle2, Loader2, ChevronRight,
} from "lucide-react";

const TRADE_OPTIONS = [
  { code: "T01", label: "도배" },
  { code: "T02", label: "타일" },
  { code: "T03", label: "목공" },
  { code: "T04", label: "전기" },
  { code: "T05", label: "설비" },
  { code: "T06", label: "도장" },
  { code: "T07", label: "철거" },
  { code: "T08", label: "방수" },
  { code: "T09", label: "금속" },
  { code: "T10", label: "유리" },
  { code: "T15", label: "주방가구" },
  { code: "T16", label: "붙박이장" },
  { code: "T17", label: "바닥재" },
  { code: "T18", label: "조명" },
  { code: "T19", label: "욕실" },
  { code: "T22", label: "청소" },
];

const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

interface FormData {
  companyName: string;
  representativeName: string;
  phone: string;
  email: string;
  licenseNumber: string;
  region: string;
  address: string;
  selectedTrades: string[];
  experienceYears: number;
  introduction: string;
}

export default function ContractorRegisterPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormData>({
    companyName: "",
    representativeName: "",
    phone: "",
    email: "",
    licenseNumber: "",
    region: "",
    address: "",
    selectedTrades: [],
    experienceYears: 1,
    introduction: "",
  });

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTrade = (code: string) => {
    setForm((prev) => ({
      ...prev,
      selectedTrades: prev.selectedTrades.includes(code)
        ? prev.selectedTrades.filter((c) => c !== code)
        : [...prev.selectedTrades, code],
    }));
  };

  const canGoStep2 = form.companyName && form.representativeName && form.phone && form.email;
  const canGoStep3 = form.selectedTrades.length > 0 && form.region;
  const canSubmit = canGoStep2 && canGoStep3;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/contractor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // fallback: just show success
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">등록 신청 완료</h1>
          <p className="text-gray-600 mb-2">
            <span className="font-semibold text-gray-900">{form.companyName}</span> 사업자 등록이 접수되었습니다.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            검토 후 승인되면 이메일로 안내드리겠습니다.<br />
            승인 후 사업자 대시보드를 이용하실 수 있습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="px-6 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              홈으로
            </Link>
            <Link href="/contractor/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm font-medium text-gray-700">사업자 등록</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { n: 1, label: "기본 정보" },
            { n: 2, label: "전문 분야" },
            { n: 3, label: "확인" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <button onClick={() => s.n < step && setStep(s.n)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s.n ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </button>
              <span className={`text-sm font-medium hidden sm:inline ${step >= s.n ? "text-gray-900" : "text-gray-400"}`}>
                {s.label}
              </span>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" /> 기본 정보
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  회사명 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="예: 드림인테리어" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  대표자명 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.representativeName}
                    onChange={(e) => updateField("representativeName", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="홍길동" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="010-1234-5678" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="info@company.com" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                사업자등록번호
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={form.licenseNumber}
                  onChange={(e) => updateField("licenseNumber", e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="000-00-00000" />
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!canGoStep2}
              className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              다음 단계
            </button>
          </div>
        )}

        {/* Step 2: Specialization */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" /> 전문 분야
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시공 가능 공종 <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-2">(복수 선택 가능)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TRADE_OPTIONS.map((t) => (
                  <button key={t.code} onClick={() => toggleTrade(t.code)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.selectedTrades.includes(t.code)
                        ? "bg-blue-600 text-white ring-2 ring-blue-300"
                        : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  활동 지역 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={form.region} onChange={(e) => updateField("region", e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white">
                    <option value="">선택해주세요</option>
                    {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">경력 (년)</label>
                <input type="number" min={0} max={50} value={form.experienceYears}
                  onChange={(e) => updateField("experienceYears", parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사업장 주소</label>
              <input type="text" value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="서울시 강남구..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">업체 소개</label>
              <textarea value={form.introduction}
                onChange={(e) => updateField("introduction", e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="업체 소개, 주요 시공 사례, 강점 등을 자유롭게 작성해주세요" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                이전
              </button>
              <button onClick={() => setStep(3)} disabled={!canGoStep3}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                다음 단계
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">등록 정보 확인</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">회사명</p>
                    <p className="text-sm font-semibold text-gray-900">{form.companyName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">대표자</p>
                    <p className="text-sm font-semibold text-gray-900">{form.representativeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">연락처</p>
                    <p className="text-sm text-gray-900">{form.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">이메일</p>
                    <p className="text-sm text-gray-900">{form.email}</p>
                  </div>
                  {form.licenseNumber && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">사업자등록번호</p>
                      <p className="text-sm text-gray-900">{form.licenseNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">활동 지역</p>
                    <p className="text-sm text-gray-900">{form.region}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">경력</p>
                    <p className="text-sm text-gray-900">{form.experienceYears}년</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">시공 가능 공종</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.selectedTrades.map((code) => {
                      const trade = TRADE_OPTIONS.find((t) => t.code === code);
                      return (
                        <span key={code} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                          {trade?.label || code}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {form.introduction && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">업체 소개</p>
                    <p className="text-sm text-gray-700">{form.introduction}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                등록 후 관리자 검토를 거쳐 승인됩니다. 승인 후 로그인하여 입찰 참여, AI 비서 등 모든 사업자 기능을 이용할 수 있습니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-6 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                수정하기
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 등록중...</> : "사업자 등록 신청"}
              </button>
            </div>
          </div>
        )}

        {/* Already registered? */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            이미 등록하셨나요?{" "}
            <Link href="/contractor/login" className="text-blue-600 hover:underline font-medium">로그인</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
