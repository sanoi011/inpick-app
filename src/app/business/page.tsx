"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Factory,
  FileText,
  Gavel,
  Loader2,
  Mail,
  MapPinned,
  PackageOpen,
  Send,
  Sparkles,
} from "lucide-react";
import HeaderV4 from "@/components/landing-v4/HeaderV4";
import PromotionalBannerSlot from "@/components/business/PromotionalBannerSlot";
import { BUSINESS_INQUIRY_TYPES, BUSINESS_MENU_ITEMS, type BusinessInquiryType } from "@/lib/business-center";

const TYPE_META: Record<BusinessInquiryType, { icon: typeof Factory; description: string; benefits: string[] }> = {
  material_supplier: {
    icon: PackageOpen,
    description: "국내 자재 제품과 재고·납품 정보를 인픽의 AI 디자인과 시공 견적에 연결합니다.",
    benefits: ["제품 검색 노출", "AI 렌더 자재 매칭", "시공 요청 연결"],
  },
  material_manufacturer: {
    icon: Factory,
    description: "브랜드·SKU·스펙·권장가를 등록하고 소비자의 실제 자재 선택지로 제공합니다.",
    benefits: ["브랜드 제품 노출", "샘플·카탈로그 연동", "데이터 제휴"],
  },
  regional_contractor: {
    icon: MapPinned,
    description: "활동 지역과 주력 공종을 등록하고 부분시공·전체 인테리어 고객을 만납니다.",
    benefits: ["지역 맞춤 매칭", "입찰공고 접근", "프로젝트·정산 관리"],
  },
};

const EMPTY_FORM = {
  companyName: "",
  businessRegistrationNo: "",
  businessAddress: "",
  contactEmail: "",
  message: "",
  website: "",
};

function formatRegistrationNo(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export default function BusinessPage() {
  const [inquiryType, setInquiryType] = useState<BusinessInquiryType>("material_supplier");
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const meta = TYPE_META[inquiryType];
  const mailto = useMemo(() => {
    const typeLabel = BUSINESS_INQUIRY_TYPES.find((item) => item.value === inquiryType)?.label || "비즈니스";
    const subject = `[INPICK 비즈니스 문의] ${typeLabel} · ${form.companyName || "새 문의"}`;
    const body = `신청 유형: ${typeLabel}\n사업자명: ${form.companyName}\n사업자등록번호: ${form.businessRegistrationNo}\n사업장 주소: ${form.businessAddress}\n회신 이메일: ${form.contactEmail}\n\n문의내용:\n${form.message}`;
    return `mailto:lookingseon@aiod.kr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [form, inquiryType]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/business/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryType, ...form }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data?.error || "문의를 접수하지 못했습니다." });
        return;
      }
      setMessage({
        type: "success",
        text: data.emailDelivered
          ? "문의가 접수되었고 담당자 메일로 전달됐습니다."
          : "문의가 관리자 문의함에 접수됐습니다. 담당자가 확인 후 회신드립니다.",
      });
      setForm(EMPTY_FORM);
    } catch {
      setMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-black">
      <HeaderV4 variant="solid" />

      <section className="overflow-hidden bg-white pt-24">
        <div className="mx-auto grid max-w-7xl items-end gap-10 px-5 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">INPICK BUSINESS PARTNER</p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.06em] sm:text-[56px]">제품에서 시공까지,<br />한국 인테리어 파트너</h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-black/52 sm:text-base">자재 제조·납품사의 실제 제품을 AI 인테리어 선택지로 연결하고, 지역 시공 협력업체에게 검증된 프로젝트를 제공합니다.</p>
            <a href="#apply" className="mt-8 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white">협업 문의하기 <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[30px] bg-[#efeae0] sm:min-h-[440px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/material-partner-poster-bg-v1.png" alt="인테리어 자재 샘플" className="absolute inset-0 h-full w-full object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#f4f0e8]/95 via-[#f4f0e8]/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <span className="inline-flex rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-bold backdrop-blur">MATERIAL · MANUFACTURING · CONSTRUCTION</span>
              <p className="mt-4 max-w-xs text-2xl font-semibold leading-tight tracking-[-0.045em]">선택된 자재가<br />실제 구매와 시공으로</p>
            </div>
          </div>
        </div>
      </section>

      <PromotionalBannerSlot placement="business_home_hero" className="px-5 py-8 lg:px-8" />

      <section id="apply" className="scroll-mt-24 border-y border-black/[0.07] bg-[#f7f7f5]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/38">PARTNERSHIP REQUEST</p>
          <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div><h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">어떤 파트너인지 선택해주세요.</h2><p className="mt-3 text-sm text-black/48">선택한 유형에 맞춰 담당자가 확인합니다.</p></div>
            <a href="mailto:lookingseon@aiod.kr" className="inline-flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4" /> lookingseon@aiod.kr</a>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {BUSINESS_INQUIRY_TYPES.map((item) => {
              const itemMeta = TYPE_META[item.value];
              const Icon = itemMeta.icon;
              const active = inquiryType === item.value;
              return (
                <button key={item.value} type="button" onClick={() => setInquiryType(item.value)} className={`rounded-[24px] border p-5 text-left transition ${active ? "border-black bg-black text-white" : "border-black/[0.08] bg-white hover:border-black/25"}`}>
                  <div className="flex items-start justify-between"><Icon className="h-5 w-5" strokeWidth={1.6} />{active && <Check className="h-4 w-4" />}</div>
                  <h3 className="mt-8 text-lg font-semibold tracking-[-0.035em]">{item.label}</h3>
                  <p className={`mt-2 text-xs leading-5 ${active ? "text-white/55" : "text-black/45"}`}>{itemMeta.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid overflow-hidden rounded-[28px] border border-black/[0.08] bg-white lg:grid-cols-[0.72fr_1.28fr]">
            <div className="bg-black p-6 text-white sm:p-8">
              {(() => { const Icon = meta.icon; return <Icon className="h-6 w-6" strokeWidth={1.5} />; })()}
              <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-white/38">Selected partner</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">{BUSINESS_INQUIRY_TYPES.find((item) => item.value === inquiryType)?.label}</h3>
              <ul className="mt-8 space-y-3">
                {meta.benefits.map((benefit) => <li key={benefit} className="flex items-center gap-2 text-sm text-white/62"><Check className="h-4 w-4 text-white" />{benefit}</li>)}
              </ul>
              <p className="mt-10 text-xs leading-6 text-white/38">접수 내용은 인픽 관리자 문의함에 안전하게 저장되며 메일 발송 설정 시 담당자에게 즉시 전달됩니다.</p>
            </div>

            <form onSubmit={submit} className="p-5 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="사업자명" required><input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} maxLength={200} placeholder="주식회사 인픽자재" required /></Field>
                <Field label="사업자등록번호" required><input value={form.businessRegistrationNo} onChange={(event) => setForm((current) => ({ ...current, businessRegistrationNo: formatRegistrationNo(event.target.value) }))} inputMode="numeric" placeholder="000-00-00000" required /></Field>
                <Field label="사업장 주소" required className="sm:col-span-2"><input value={form.businessAddress} onChange={(event) => setForm((current) => ({ ...current, businessAddress: event.target.value }))} maxLength={500} placeholder="시·군·구를 포함한 사업장 주소" required /></Field>
                <Field label="회신 이메일" required className="sm:col-span-2"><input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} maxLength={200} placeholder="partner@company.co.kr" required /></Field>
                <Field label="문의내용" required className="sm:col-span-2"><textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} maxLength={4000} rows={7} placeholder="제품 카탈로그, 납품 가능 지역, 주력 공종 등 협업 내용을 적어주세요." required /></Field>
                <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="hidden" />
              </div>
              {message && <p className={`mt-4 rounded-2xl px-4 py-3 text-xs font-semibold leading-5 ${message.type === "success" ? "bg-black text-white" : "bg-black/[0.05] text-black"}`}>{message.text}</p>}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={sending} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white disabled:opacity-45">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}문의 접수하기</button>
                <a href={mailto} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/10 px-5 text-sm font-bold"><Mail className="h-4 w-4" />메일로 직접 문의</a>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/38">BUSINESS SERVICES</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">인픽 사업자 전용 서비스</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_MENU_ITEMS.slice(1).map((item, index) => {
              const icons = [Gavel, Building2, Sparkles, FileText, Building2];
              const Icon = icons[index] || Building2;
              return <Link key={item.href} href={item.href} className="group rounded-[22px] border border-black/[0.08] p-5 transition hover:border-black/30"><div className="flex items-start justify-between"><Icon className="h-5 w-5" strokeWidth={1.6} /><ArrowRight className="h-4 w-4 text-black/25 transition group-hover:translate-x-1 group-hover:text-black" /></div><h3 className="mt-8 text-base font-semibold">{item.label}</h3><p className="mt-2 text-xs text-black/44">{item.description}</p></Link>;
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="text-[11px] font-bold text-black/55">{label}{required && <span className="ml-1 text-black/30">필수</span>}</span><span className="mt-2 block [&_input]:h-12 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-black/10 [&_input]:px-4 [&_input]:text-sm [&_input]:outline-none [&_input]:transition focus-within:[&_input]:border-black/35 [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:rounded-2xl [&_textarea]:border [&_textarea]:border-black/10 [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:leading-6 [&_textarea]:outline-none focus-within:[&_textarea]:border-black/35">{children}</span></label>;
}
