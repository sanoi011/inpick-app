"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import { createClient } from "@/lib/supabase/client";

interface ContractState {
  consumerSigned: boolean;
  contractorSigned: boolean;
  totalAmount: number;
  inpickFee: number;
  consumerName: string;
}

export default function ContractorContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<ContractState>({
    consumerSigned: true,
    contractorSigned: false,
    totalAmount: 38420000,
    inpickFee: 1921000,
    consumerName: "김OO",
  });
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`contract:${id}:contractor`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contracts", filter: `id=eq.${id}` },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          setState((s) => ({
            ...s,
            consumerSigned: !!row.consumer_signed,
            contractorSigned: !!row.contractor_signed,
          }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  const handleSign = async () => {
    setSigning(true);
    await new Promise((r) => setTimeout(r, 900));
    setState((s) => ({ ...s, contractorSigned: true }));
    setSigning(false);
  };

  const bothSigned = state.consumerSigned && state.contractorSigned;

  return (
    <LenisProvider>
      <main className="font-kr relative min-h-screen overflow-hidden bg-burgundy text-offwhite">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[50%] bg-[radial-gradient(ellipse_at_top,rgba(247,59,32,0.20),transparent_60%)]" />
          <div className="absolute -right-[10%] top-[15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.30),transparent_70%)] blur-3xl" />
          <div className="absolute -left-[12%] top-[50%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(122,39,57,0.40),transparent_70%)] blur-3xl" />
        </div>

        <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 pt-10 lg:px-8">
          <button
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-offwhite backdrop-blur hover:bg-white/10"
            aria-label="이전"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-mono inline-flex items-center gap-1.5 text-[12px] tracking-[0.12em] text-apricot">
            <Building2 className="h-3.5 w-3.5" /> CONTRACT · 사업자
          </span>
          <a href="/" className="font-en text-[18px] font-extrabold tracking-tightest">
            in<span className="text-primary-300">pick</span>
          </a>
        </header>

        <section className="relative z-20 mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-8 backdrop-blur-2xl">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background: "linear-gradient(90deg,transparent,#FDCBC4,transparent)",
                  }}
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-300">
                  실내건축 표준계약서
                </p>
                <h1 className="mt-2 text-[1.8rem] font-extrabold tracking-tightest">
                  계약 #{id}
                </h1>
                <p className="mt-1 text-[0.85rem] text-apricot/80">
                  소비자 서명 완료 · 이제 사업자 측 서명 차례입니다
                </p>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <DarkSig role="소비자" name={state.consumerName} signed={state.consumerSigned} />
                  <DarkSig role="사업자" name="○○인테리어" signed={state.contractorSigned} self />
                </div>

                <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-widest text-primary-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> 자동 첨부 5종
                  </div>
                  <ul className="mt-3 grid gap-2 text-[0.85rem] text-offwhite sm:grid-cols-2">
                    {[
                      "실내건축 표준계약서",
                      "부위별 요구조건 명세서",
                      "AI 디자인 렌더 (8장)",
                      "상세 견적서",
                      "2D 평면도",
                    ].map((a) => (
                      <li
                        key={a}
                        className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary-300" />
                        <span className="font-medium tracking-tight">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 grid gap-4 rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-apricot/60">
                      총액
                    </p>
                    <p className="mt-1 text-[1.4rem] font-extrabold tabular tracking-tightest">
                      ₩ {state.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-apricot/60">
                      InPick 수수료
                    </p>
                    <p className="mt-1 text-[1.1rem] font-bold tabular text-apricot">
                      − ₩ {state.inpickFee.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-apricot/60">
                      실 수령액
                    </p>
                    <p className="mt-1 text-[1.1rem] font-bold tabular text-primary-300">
                      ₩ {(state.totalAmount - state.inpickFee).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSign}
                  disabled={state.contractorSigned || signing}
                  className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-500 px-6 text-[14px] font-semibold tracking-tight text-white shadow-cta transition-colors hover:bg-primary-600 disabled:bg-white/10 disabled:text-apricot/40 disabled:shadow-none"
                >
                  {state.contractorSigned
                    ? "서명 완료"
                    : signing
                    ? "서명 처리 중…"
                    : "동의하고 서명하기"}
                </button>
                {bothSigned && (
                  <p className="mt-3 rounded-xl bg-success-bg px-3 py-2 text-center text-[0.78rem] text-success-text">
                    🎉 계약 완료 · 다운로드가 활성화되었습니다
                  </p>
                )}
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="space-y-4">
                <DarkDownload enabled={bothSigned} icon={FileText} label="계약서 PDF" />
                <DarkDownload enabled={bothSigned} icon={FileSpreadsheet} label="상세 내역 엑셀" />
                <DarkDownload enabled={bothSigned} icon={Download} label="평면도 ZIP" />
              </div>
            </aside>
          </div>
        </section>
      </main>
    </LenisProvider>
  );
}

function DarkSig({
  role,
  name,
  signed,
  self,
}: {
  role: string;
  name: string;
  signed: boolean;
  self?: boolean;
}) {
  return (
    <motion.div
      animate={{ borderColor: signed ? "#FDCBC4" : "rgba(255,255,255,0.15)" }}
      className={`rounded-2xl border-2 p-4 transition-colors ${
        signed ? "bg-white/[0.08]" : "bg-white/[0.04]"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-apricot/60">
        {role} {self && "(나)"}
      </p>
      <p className="mt-1 text-[1rem] font-bold tracking-tight">{name}</p>
      <span
        className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-bold ${
          signed ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"
        }`}
      >
        {signed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {signed ? "서명 완료" : "서명 대기"}
      </span>
    </motion.div>
  );
}

function DarkDownload({
  enabled,
  icon: Icon,
  label,
}: {
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      disabled={!enabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
        enabled
          ? "border-white/20 bg-white/[0.06] text-offwhite hover:border-primary-300 hover:bg-white/[0.10]"
          : "border-dashed border-white/15 bg-white/[0.02] text-apricot/40"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
          enabled ? "bg-primary-500 text-white" : "bg-white/5 text-apricot/40"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-[0.92rem] font-bold tracking-tight">{label}</span>
      <Download className="h-4 w-4" />
    </button>
  );
}
