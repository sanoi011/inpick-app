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
  ShieldCheck,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import { createClient } from "@/lib/supabase/client";

interface ContractState {
  consumerSigned: boolean;
  contractorSigned: boolean;
  totalAmount: number;
  inpickFee: number;
  contractorName: string;
  signedAt?: string;
}

export default function ConsumerContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<ContractState>({
    consumerSigned: false,
    contractorSigned: false,
    totalAmount: 38420000,
    inpickFee: 1921000,
    contractorName: "○○인테리어",
  });
  const [signing, setSigning] = useState(false);

  // Realtime 양면 동기화 — contracts 테이블 구독 자리 (실제 스키마 마이그 후 활성화)
  useEffect(() => {
    const channel = supabase
      .channel(`contract:${id}:consumer`)
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
            signedAt: row.signed_at,
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
    // 실제: supabase.from("contracts").update({ consumer_signed: true })
    await new Promise((r) => setTimeout(r, 900));
    setState((s) => ({
      ...s,
      consumerSigned: true,
      signedAt: s.contractorSigned ? new Date().toISOString() : s.signedAt,
    }));
    setSigning(false);
  };

  const bothSigned = state.consumerSigned && state.contractorSigned;

  return (
    <LenisProvider>
      <main className="font-kr relative min-h-screen overflow-hidden bg-offwhite text-ink">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.85),transparent_60%)]" />
          <div className="absolute -right-[10%] top-[15%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.12),transparent_70%)] blur-3xl" />
        </div>

        <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-6 pt-10 lg:px-8">
          <button
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white/85 text-ink backdrop-blur hover:bg-white"
            aria-label="이전"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[12px] tracking-[0.12em] text-ink-60">
            CONTRACT · 소비자
          </span>
          <a href="/" className="font-en text-[18px] font-extrabold tracking-tightest text-ink">
            in<span className="text-primary-500">pick</span>
          </a>
        </header>

        <section className="relative z-20 mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* 좌측: 계약 본문 */}
            <div className="lg:col-span-8">
              <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white p-8 shadow-card">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background: "linear-gradient(90deg,transparent,#F73B20,transparent)",
                  }}
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-500">
                  실내건축 표준계약서
                </p>
                <h1 className="mt-2 text-[1.8rem] font-extrabold tracking-tightest text-ink">
                  계약 #{id}
                </h1>
                <p className="mt-1 text-[0.85rem] text-ink-60">
                  국토부 고시 표준계약서 기반 · 양면 실시간 서명
                </p>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <SigPanel
                    role="소비자"
                    name="김OO"
                    signed={state.consumerSigned}
                    self
                  />
                  <SigPanel
                    role="사업자"
                    name={state.contractorName}
                    signed={state.contractorSigned}
                  />
                </div>

                <div className="mt-8 rounded-2xl bg-primary-50 p-5">
                  <div className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-widest text-primary-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> 자동 첨부 5종
                  </div>
                  <ul className="mt-3 grid gap-2 text-[0.85rem] text-ink sm:grid-cols-2">
                    {[
                      "실내건축 표준계약서",
                      "부위별 요구조건 명세서",
                      "AI 디자인 렌더 (8장)",
                      "상세 견적서",
                      "2D 평면도",
                    ].map((a) => (
                      <li
                        key={a}
                        className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-primary-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary-500" />
                        <span className="font-medium tracking-tight">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 grid gap-4 rounded-2xl border border-primary-100 bg-white p-5 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-40">
                      총액
                    </p>
                    <p className="mt-1 text-[1.4rem] font-extrabold tabular tracking-tightest text-ink">
                      ₩ {state.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-40">
                      InPick 수수료 5%
                    </p>
                    <p className="mt-1 text-[1.1rem] font-bold tabular text-ink">
                      ₩ {state.inpickFee.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-40">
                      상태
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[0.85rem] font-bold">
                      {bothSigned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-success-text">
                          <CheckCircle2 className="h-3 w-3" /> 계약 완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-warning-text">
                          <Clock className="h-3 w-3" /> 서명 대기
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSign}
                  disabled={state.consumerSigned || signing}
                  className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-500 px-6 text-[14px] font-semibold tracking-tight text-white shadow-cta transition-colors hover:bg-primary-600 disabled:bg-primary-100 disabled:text-ink-40 disabled:shadow-none"
                >
                  {state.consumerSigned
                    ? "서명 완료"
                    : signing
                    ? "서명 처리 중…"
                    : "동의하고 서명하기"}
                </button>
                <p className="mt-3 text-center text-[0.7rem] text-ink-40">
                  서명하면 표준계약서가 즉시 발효되며, 사업자 측에도 실시간 반영됩니다.
                </p>
              </div>
            </div>

            {/* 우측: 다운로드 (계약 완료 시 활성) */}
            <aside className="lg:col-span-4">
              <div className="space-y-4">
                <DownloadCard
                  enabled={bothSigned}
                  icon={FileText}
                  label="계약서 PDF"
                />
                <DownloadCard
                  enabled={bothSigned}
                  icon={FileSpreadsheet}
                  label="상세 내역 엑셀"
                />
                <DownloadCard enabled={bothSigned} icon={Download} label="평면도 ZIP" />
                {!bothSigned && (
                  <p className="rounded-2xl bg-warning-bg px-4 py-3 text-[0.78rem] text-warning-text">
                    양면 서명이 완료되면 다운로드가 활성화됩니다.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
    </LenisProvider>
  );
}

function SigPanel({
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
      animate={{ borderColor: signed ? "#F73B20" : "rgba(247,59,32,0.18)" }}
      className={`rounded-2xl border-2 p-4 transition-colors ${
        signed ? "bg-primary-50/60" : "bg-white"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-40">
        {role} {self && "(나)"}
      </p>
      <p className="mt-1 text-[1rem] font-bold tracking-tight text-ink">{name}</p>
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

function DownloadCard({
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
          ? "border-primary-200 bg-white text-ink hover:border-primary-400 hover:shadow-card"
          : "border-dashed border-primary-200 bg-primary-50/40 text-ink-40"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
          enabled ? "bg-primary-500 text-white" : "bg-primary-100 text-ink-40"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-[0.92rem] font-bold tracking-tight">{label}</span>
      <Download className="h-4 w-4" />
    </button>
  );
}
