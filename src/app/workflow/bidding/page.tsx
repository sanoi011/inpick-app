"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileCheck2,
  Calendar,
  Paperclip,
  Hexagon,
  Plus,
  Check,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import { useTokens } from "@/hooks/useTokens";

const REQUIRED_CONDITIONS = [
  {
    id: "biz_address",
    icon: Building2,
    title: "사업자등록증 사업장 주소지 확인",
    desc: "허위·페이퍼 업체 차단을 위해 사업장 실주소 확인을 요구합니다.",
  },
  {
    id: "std_contract",
    icon: FileCheck2,
    title: "실내건축 표준계약서 시행 동의",
    desc: "분쟁 시 양측을 보호하는 국토부 고시 표준계약서 시행에 동의해야 합니다.",
  },
];

const PERIOD_OPTIONS = [
  { v: 3, label: "3일" },
  { v: 7, label: "7일", recommended: true },
  { v: 14, label: "14일" },
];

const DRAWING_OPTIONS = [
  { id: "elev4", label: "실별 4면 입면도", cost: 5 },
  { id: "render", label: "입면 렌더링 도면", cost: 8 },
  { id: "ceil", label: "천장 평면도", cost: 3 },
  { id: "section", label: "상세 단면도", cost: 4 },
  { id: "schedule", label: "공정표 + 일정표", cost: 2 },
  { id: "spec", label: "자재 사양서", cost: 3 },
];

const AUTO_ATTACHMENTS = [
  "실내건축 표준계약서",
  "부위별 요구조건 명세서",
  "AI 디자인 렌더 이미지 (8장)",
  "상세 견적서",
  "2D 평면도",
];

export default function BiddingPage() {
  const router = useRouter();
  const { balance } = useTokens();

  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [period, setPeriod] = useState<number>(7);
  const [pickedOpts, setPickedOpts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const allRequired = REQUIRED_CONDITIONS.every((c) => accepted[c.id]);
  const optionTokenCost = useMemo(
    () =>
      pickedOpts.reduce((s, id) => {
        const opt = DRAWING_OPTIONS.find((o) => o.id === id);
        return s + (opt?.cost ?? 0);
      }, 0),
    [pickedOpts]
  );
  const canPost = allRequired;

  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const postedDate = fmt(today);
  const deadlineDate = fmt(new Date(today.getTime() + period * 86400000));
  const selectionDate = fmt(new Date(today.getTime() + (period + 3) * 86400000));

  const handlePost = () => {
    if (!canPost) return;
    // 실제로는 Supabase bidding_posts insert + 토큰 차감 RPC. 지금은 다음 단계로 이동.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "bidding_post",
        JSON.stringify({ period, pickedOpts, optionTokenCost, notes })
      );
    }
    router.push("/contract/consumer/demo");
  };

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-[#FFF6F5] text-primary-900">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.85),transparent_60%)]" />
          <div className="absolute -right-[12%] top-[15%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.10),transparent_70%)] blur-3xl" />
        </div>

        <Notch step={5} total={5} />

        <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 pt-12 lg:px-8 lg:pt-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow/estimate")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white/85 text-primary-900 backdrop-blur hover:bg-white"
              aria-label="이전"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[0.85rem] font-semibold tracking-tight text-primary-900/80">업체 매칭 입찰</span>
          </div>
          <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
        </header>

        <section className="relative z-20 mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-600">
              STEP 05
            </p>
            <h1 className="mt-3 text-[2.4rem] font-extrabold leading-[1.02] tracking-tightest text-primary-900 sm:text-[3.4rem] lg:text-[4rem]">
              조건 두 가지만,
              <br />
              <span className="text-gradient-primary">업체 매칭 시작.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-primary-900/70">
              과한 조건 없이 단 두 가지만. 견적·도면·계약서까지 한 번에 묶어서 업체에 전달됩니다.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-12">
            {/* 좌: 필수 조건 + 일정 + 옵션 + 메모 */}
            <div className="space-y-5 lg:col-span-8">
              {/* 필수 조건 */}
              <Card title="필수 입찰 조건" subtitle="이 두 가지만 동의하면 됩니다">
                <div className="space-y-2.5">
                  {REQUIRED_CONDITIONS.map((c) => {
                    const Icon = c.icon;
                    const sel = !!accepted[c.id];
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          setAccepted((p) => ({ ...p, [c.id]: !p[c.id] }))
                        }
                        className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                          sel
                            ? "border-primary-500 bg-primary-50/60 shadow-card"
                            : "border-primary-100 bg-white/85 hover:border-primary-300"
                        }`}
                      >
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            sel ? "bg-primary-500 text-white" : "bg-primary-50 text-primary-600"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex-1">
                          <p className="text-[0.92rem] font-bold tracking-tight text-primary-900">{c.title}</p>
                          <p className="mt-1 text-[0.78rem] text-primary-900/60">{c.desc}</p>
                        </div>
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                            sel ? "bg-primary-500 text-white" : "border border-primary-200 bg-white"
                          }`}
                        >
                          {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* 일정 */}
              <Card title="입찰 공고 일정" subtitle="기간이 짧을수록 응답 업체가 적을 수 있어요">
                <div className="grid grid-cols-3 gap-2">
                  {PERIOD_OPTIONS.map((p) => {
                    const sel = period === p.v;
                    return (
                      <button
                        key={p.v}
                        onClick={() => setPeriod(p.v)}
                        className={`relative rounded-xl border px-3 py-3 text-center transition-all ${
                          sel
                            ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                            : "border-primary-100 bg-white/85 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                        }`}
                      >
                        <p className="text-base font-extrabold tracking-tighter">{p.label}</p>
                        {p.recommended && (
                          <span
                            className={`absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${
                              sel ? "bg-token-200 text-token-500" : "bg-token-200 text-token-500"
                            }`}
                          >
                            추천
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-2 rounded-xl bg-primary-50/60 p-4 text-[0.78rem] sm:grid-cols-3">
                  <DateRow icon={Calendar} label="공고 게시" value={postedDate} />
                  <DateRow icon={Calendar} label="입찰 마감" value={deadlineDate} />
                  <DateRow icon={Calendar} label="업체 선정" value={selectionDate} />
                </div>
              </Card>

              {/* 추가 도면 옵션 */}
              <Card
                title="추가 도면 옵션 (PRO)"
                subtitle="전달할 도면을 더 풍성하게. 토큰으로 결제됩니다"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {DRAWING_OPTIONS.map((o) => {
                    const sel = pickedOpts.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() =>
                          setPickedOpts((p) =>
                            sel ? p.filter((x) => x !== o.id) : [...p, o.id]
                          )
                        }
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                          sel
                            ? "border-primary-500 bg-primary-50/70 shadow-card"
                            : "border-primary-100 bg-white/85 hover:border-primary-300"
                        }`}
                      >
                        <div>
                          <p className="text-[0.85rem] font-bold tracking-tight text-primary-900">{o.label}</p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-bold tabular text-token-400">
                            <Hexagon className="h-3 w-3 fill-token-400" /> {o.cost}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                            sel ? "bg-primary-500 text-white" : "border border-primary-200 bg-white text-primary-300"
                          }`}
                        >
                          {sel ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {pickedOpts.length > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-token-50 px-4 py-3">
                    <span className="text-[0.82rem] font-semibold text-token-500">
                      옵션 {pickedOpts.length}개 선택
                    </span>
                    <span className="text-base font-extrabold tabular tracking-tighter text-token-500">
                      <Hexagon className="mr-1 inline h-3.5 w-3.5 fill-token-400 text-token-400" />
                      {optionTokenCost}
                    </span>
                  </div>
                )}
              </Card>

              {/* 메모 */}
              <Card title="추가 요구사항 (선택)" subtitle="업체에 전달할 특이사항이 있으면 적어주세요">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="예: 1층 거주 중이라 평일 작업만 가능합니다 / 펫이 있어 본드 시공은 피해주세요"
                  className="w-full rounded-xl border border-primary-100 bg-white/90 px-4 py-3 text-sm leading-relaxed tracking-tight text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </Card>
            </div>

            {/* 우: 자동 첨부 + 게시 버튼 */}
            <aside className="lg:col-span-4">
              <div className="space-y-5">
                <Card title="자동 첨부 파일" subtitle="입찰 공고에 자동으로 묶여 전달됩니다">
                  <ul className="space-y-2">
                    {AUTO_ATTACHMENTS.map((a) => (
                      <li
                        key={a}
                        className="flex items-center gap-2 rounded-lg bg-primary-50/60 px-3 py-2 text-[0.82rem] text-primary-900/80"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                        <span className="font-semibold">{a}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <div className="rounded-[28px] border border-primary-100 bg-white/85 p-6 shadow-card backdrop-blur-2xl">
                  <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-900/50">
                    옵션 비용
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tabular tracking-tightest">
                    <Hexagon className="mr-1 inline h-4 w-4 fill-token-400 text-token-400" />
                    <span className="text-gradient-primary">{optionTokenCost}</span>
                  </p>
                  <p className="text-[0.7rem] text-primary-900/40">
                    잔액 {balance} → 게시 후 {Math.max(0, balance - optionTokenCost)}
                  </p>

                  <button
                    onClick={handlePost}
                    disabled={!canPost}
                    className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-500 px-4 py-3.5 text-sm font-semibold tracking-tight text-white shadow-cta transition-all hover:bg-primary-600 disabled:bg-primary-100 disabled:text-primary-900/40 disabled:shadow-none"
                  >
                    입찰 공고 게시 <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {!canPost && (
                    <p className="mt-2 text-center text-[0.7rem] text-danger-text">
                      필수 입찰 조건 2개를 모두 동의해야 게시할 수 있습니다
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <footer className="sticky bottom-6 z-30 mx-auto flex max-w-md items-center justify-center px-6 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 bg-white/85 px-4 py-2 backdrop-blur-md">
            {Array.from({ length: 5 }).map((_, i) => {
              const idx = i + 1;
              const active = idx === 5;
              const done = idx < 5;
              return (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    active ? "w-7 bg-primary-500" : done ? "w-3 bg-primary-300" : "w-3 bg-primary-100"
                  }`}
                />
              );
            })}
            <span className="ml-2 text-[0.7rem] font-semibold tabular text-primary-900/60">5/5</span>
          </div>
        </footer>
      </main>
    </LenisProvider>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/85 p-6 shadow-card backdrop-blur-2xl"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
      />
      <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-600">{title}</p>
      {subtitle && <p className="mt-1 text-[0.78rem] text-primary-900/50">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function DateRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary-600" />
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">{label}</p>
        <p className="tabular text-[0.82rem] font-bold text-primary-900">{value}</p>
      </div>
    </div>
  );
}
