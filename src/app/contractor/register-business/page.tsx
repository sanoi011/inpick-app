/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowLeft,
  Loader2,
  Check,
  Shield,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FormData {
  businessNumber: string;
  corpNumber: string;
  ceoName: string;
  businessAddress: string;
  mainPhone: string;
  contactPhone: string;
  contactEmail: string;
  companyName: string;
}

const FIELDS: Array<{
  key: keyof FormData;
  label: string;
  required: boolean;
  placeholder: string;
  desc?: string;
  type?: string;
}> = [
  {
    key: "companyName",
    label: "상호 (회사명)",
    required: false,
    placeholder: "(주) 인픽인테리어",
    desc: "비워두면 대표자명 + '사업자'로 자동 생성",
  },
  {
    key: "businessNumber",
    label: "사업자등록번호",
    required: true,
    placeholder: "123-45-67890",
    desc: "10자리 숫자 (하이픈 입력 가능)",
  },
  {
    key: "corpNumber",
    label: "법인등록번호 (선택)",
    required: false,
    placeholder: "123456-7890123",
    desc: "법인 사업자만 입력. 개인사업자는 비워두세요",
  },
  {
    key: "ceoName",
    label: "대표자명",
    required: true,
    placeholder: "홍길동",
  },
  {
    key: "businessAddress",
    label: "사업장 주소지",
    required: true,
    placeholder: "서울특별시 강남구 테헤란로 123",
    desc: "사업자등록증 상의 주소",
  },
  {
    key: "mainPhone",
    label: "대표 연락처",
    required: true,
    placeholder: "02-1234-5678",
    type: "tel",
  },
  {
    key: "contactPhone",
    label: "담당자 연락처",
    required: true,
    placeholder: "010-1234-5678",
    type: "tel",
  },
  {
    key: "contactEmail",
    label: "담당자 이메일 (세금계산서용)",
    required: true,
    placeholder: "tax@company.kr",
    type: "email",
    desc: "세금계산서 발행 시 사용됩니다",
  },
];

export default function RegisterBusinessPage() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<FormData>({
    businessNumber: "",
    corpNumber: "",
    ceoName: "",
    businessAddress: "",
    mainPhone: "",
    contactPhone: "",
    contactEmail: "",
    companyName: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 인증 체크 — supabase 세션 없으면 login
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/contractor/login");
        return;
      }
      // 이메일 자동 채움
      if (user.email) {
        setData((d) => (d.contactEmail ? d : { ...d, contactEmail: user.email! }));
      }
    })();
  }, [router, supabase]);

  const update = (key: keyof FormData, val: string) =>
    setData((d) => ({ ...d, [key]: val }));

  const formatBizNumber = (v: string): string => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const formatCorpNumber = (v: string): string => {
    const digits = v.replace(/\D/g, "").slice(0, 13);
    if (digits.length < 7) return digits;
    return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  };

  const handleSubmit = async () => {
    setError("");
    // 필수 검증
    for (const f of FIELDS.filter((x) => x.required)) {
      if (!data[f.key].trim()) {
        setError(`${f.label}을(를) 입력해주세요.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contractor/register-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "등록 실패");
        return;
      }
      // 사업자 토큰 + 정보 저장
      localStorage.setItem("contractor_token", d.token);
      localStorage.setItem("contractor_id", d.contractor.id);
      localStorage.setItem("contractor_name", d.contractor.company_name);
      setSuccess(true);
      setTimeout(() => router.push("/contractor"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center px-6">
        <div className="bg-white border border-emerald-200 rounded p-10 text-center max-w-sm shadow-md">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
            <Check className="h-8 w-8" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-extrabold text-zinc-900">등록 완료</h2>
          <p className="mt-2 text-sm text-zinc-600">
            사업자 정보가 등록되었습니다.
            <br />
            관리자 검증 후 입찰 참여 가능합니다.
          </p>
          <p className="mt-4 text-xs text-zinc-400">사업자 메인으로 이동 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="bg-[#1B3556] text-white">
        <div className="max-w-3xl mx-auto px-6 py-1.5 text-[0.7rem]">
          대한민국 인테리어 사업자 종합 시스템 · 사업자 정보 등록
        </div>
      </div>

      <header className="bg-white border-b-2 border-[#1B3556]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/contractor")}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#1B3556]" />
            <span className="text-lg font-extrabold tracking-tight text-zinc-900">
              사업자 정보 등록
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-zinc-300 rounded shadow-sm">
          <div className="px-6 py-5 border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-[#1B3556]" />
              <span className="text-[0.7rem] font-bold uppercase tracking-widest text-[#1B3556]">
                입찰 참여 조건 — 1단계 사업자 등록
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
              사업자 정보 입력
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              아래 정보는 사업자 검증 및 세금계산서 발행에 사용됩니다.
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block">
                  <span className="text-sm font-bold text-zinc-900 inline-flex items-center gap-1">
                    {f.label}
                    {f.required && <span className="text-red-500">*</span>}
                  </span>
                  {f.desc && (
                    <span className="block mt-0.5 text-[0.7rem] text-zinc-500">
                      {f.desc}
                    </span>
                  )}
                  <input
                    type={f.type || "text"}
                    value={data[f.key]}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (f.key === "businessNumber") v = formatBizNumber(v);
                      else if (f.key === "corpNumber") v = formatCorpNumber(v);
                      update(f.key, v);
                    }}
                    placeholder={f.placeholder}
                    className="mt-2 w-full rounded border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#1B3556] focus:ring-1 focus:ring-[#1B3556]/20 tabular"
                  />
                </label>
              </div>
            ))}

            {error && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <p className="text-[0.7rem] text-zinc-500">
              관리자 검증 후 입찰 참여가 활성화됩니다.
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded bg-[#1B3556] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#2a4870] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  등록 중…
                </>
              ) : (
                <>등록하기</>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
