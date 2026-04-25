"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Download,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import LenisProvider from "@/components/landing-v4/LenisProvider";
import Notch from "@/components/workflow/Notch";
import TokenBadge from "@/components/workflow/TokenBadge";
import { useTokens } from "@/hooks/useTokens";

interface Row {
  cat: string;
  item: string;
  spec: string;
  qty: number;
  unit: string;
  unitPrice: number;
  source: string;
}

const SEED_ROWS: Row[] = [
  { cat: "철거", item: "내장 철거", spec: "전체 84.9㎡", qty: 84.9, unit: "㎡", unitPrice: 22000, source: "한국물가협회 2026Q1" },
  { cat: "철거", item: "폐기물 처리", spec: "혼합 폐기물", qty: 1, unit: "식", unitPrice: 850000, source: "LH 표준" },
  { cat: "바닥", item: "강마루", spec: "LX 12T 헤링본 오크", qty: 84.9, unit: "㎡", unitPrice: 64000, source: "G2B 실거래가" },
  { cat: "벽지", item: "실크 벽지", spec: "KCC 프리미엄", qty: 240, unit: "㎡", unitPrice: 9500, source: "한국물가협회 2026Q1" },
  { cat: "주방", item: "주방 가구", spec: "한샘 제트 4.2m", qty: 1, unit: "조", unitPrice: 8900000, source: "G2B 실거래가" },
  { cat: "주방", item: "스토브·후드", spec: "삼성 인덕션 + 후드", qty: 1, unit: "조", unitPrice: 1900000, source: "한국물가협회 2026Q1" },
  { cat: "욕실", item: "욕실 리모델링", spec: "타일·도기·수전 일체", qty: 2, unit: "실", unitPrice: 3400000, source: "LH 표준" },
  { cat: "조명", item: "조명 일체", spec: "LED 매입 + 펜던트", qty: 1, unit: "식", unitPrice: 2100000, source: "G2B 실거래가" },
  { cat: "도장", item: "벽·천장 도장", spec: "친환경 수성", qty: 320, unit: "㎡", unitPrice: 11000, source: "한국물가협회 2026Q1" },
  { cat: "기타", item: "현관·발코니", spec: "타일·중문", qty: 1, unit: "식", unitPrice: 1800000, source: "LH 표준" },
];

export default function EstimatePage() {
  const router = useRouter();
  const { balance } = useTokens();

  const [rows, setRows] = useState<Row[]>(SEED_ROWS);
  const [vatIncl, setVatIncl] = useState(true);

  // 입력 디바운스 없이 직접 반영 (단일 사용자 시뮬레이션)
  const subtotal = useMemo(
    () => rows.reduce((s, r) => s + Math.round(r.qty * r.unitPrice), 0),
    [rows]
  );
  const vat = Math.round(subtotal * 0.1);
  const total = vatIncl ? subtotal + vat : subtotal;
  const inpickFee = Math.round(total * 0.05);

  const updateQty = (i: number, q: number) =>
    setRows((curr) => curr.map((r, k) => (k === i ? { ...r, qty: Math.max(0, q) } : r)));

  // 카테고리별 그룹
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      if (!m.has(r.cat)) m.set(r.cat, []);
      m.get(r.cat)!.push(r);
    });
    return Array.from(m.entries());
  }, [rows]);

  return (
    <LenisProvider>
      <main className="relative min-h-screen overflow-hidden bg-[#FFF6F5] text-primary-900">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[40%] bg-[radial-gradient(ellipse_at_top,rgba(254,233,230,0.85),transparent_60%)]" />
          <div className="absolute -right-[12%] top-[10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(247,59,32,0.10),transparent_70%)] blur-3xl" />
        </div>

        <Notch step={4} total={5} />

        <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 pt-12 lg:px-8 lg:pt-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflow/branch")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white/85 text-primary-900 backdrop-blur hover:bg-white"
              aria-label="이전"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[0.85rem] font-semibold tracking-tight text-primary-900/80">견적 산출</span>
          </div>
          <div className="flex items-center gap-2">
            <TokenBadge balance={balance} onClick={() => router.push("/account/tokens")} />
            <button
              onClick={() => router.push("/workflow/bidding")}
              className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
            >
              업체 매칭으로 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <section className="relative z-20 mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* 좌: 견적 카드 */}
            <div className="lg:col-span-8">
              <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/85 shadow-card backdrop-blur-2xl">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, #F73B20, transparent)" }}
                />
                <div className="flex items-center justify-between border-b border-primary-100 px-7 py-5">
                  <div>
                    <p className="text-[0.78rem] font-semibold uppercase tracking-widest text-primary-600">
                      STEP 04
                    </p>
                    <h1 className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-tighter text-primary-900">
                      상세 견적
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/70 px-3 py-1.5">
                    <span className="text-[0.7rem] font-medium text-primary-900/60">VAT</span>
                    <button
                      onClick={() => setVatIncl((v) => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${vatIncl ? "bg-primary-500" : "bg-neutral-300"}`}
                      aria-label="VAT 포함 토글"
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${vatIncl ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-[0.7rem] font-bold text-primary-900">{vatIncl ? "포함" : "별도"}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[0.85rem]">
                    <thead>
                      <tr className="border-b border-primary-100 bg-primary-50/40 text-left text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">
                        <th className="px-3 py-2">항목</th>
                        <th className="px-3 py-2">규격</th>
                        <th className="px-3 py-2 text-right">수량</th>
                        <th className="px-3 py-2">단위</th>
                        <th className="px-3 py-2 text-right">단가</th>
                        <th className="px-3 py-2 text-right">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(([cat, list]) => (
                        <CategoryGroup
                          key={cat}
                          cat={cat}
                          rows={list}
                          updateQty={(rowIndex, q) => {
                            const globalIdx = rows.findIndex((r) => r === list[rowIndex]);
                            if (globalIdx >= 0) updateQty(globalIdx, q);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 합계 */}
                <div className="border-t border-primary-100 px-7 py-5">
                  <div className="flex items-center justify-between text-[0.85rem]">
                    <span className="text-primary-900/60">소계</span>
                    <span className="tabular font-semibold text-primary-900">₩ {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[0.85rem]">
                    <span className="text-primary-900/60">VAT 10% {vatIncl ? "(포함)" : "(별도)"}</span>
                    <span className="tabular font-semibold text-primary-900">₩ {vat.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-primary-100 pt-3">
                    <span className="text-[0.85rem] font-bold text-primary-900">총액</span>
                    <span className="text-[2rem] font-extrabold tabular leading-none tracking-tightest">
                      <span className="text-gradient-primary">₩ {total.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[0.78rem]">
                    <span className="text-primary-900/50">InPick 수수료 5%</span>
                    <span className="tabular text-primary-900/70">₩ {inpickFee.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 우: 다운로드 / 근거 / 다음 단계 */}
            <aside className="lg:col-span-4">
              <div className="space-y-5">
                {/* 다운로드 (잠금) */}
                <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/85 p-6 shadow-card backdrop-blur-2xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-warning-bg text-warning-text">
                      <Lock className="h-4 w-4" />
                    </span>
                    <p className="text-[0.92rem] font-bold tracking-tight text-primary-900">출력 제한</p>
                  </div>
                  <p className="mt-3 text-[0.82rem] leading-relaxed text-primary-900/70">
                    PDF·엑셀 다운로드는 <span className="font-bold">계약 진행</span> 단계에서 활성화됩니다.
                  </p>
                  <div className="mt-4 space-y-2">
                    <LockedButton icon={Download} label="견적서 PDF" />
                    <LockedButton icon={FileSpreadsheet} label="상세 내역 엑셀" />
                  </div>
                  <p className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-[0.7rem] text-warning-text">
                    워터마크 “InPick 미계약 · 출력 제한”
                  </p>
                </div>

                {/* 근거 */}
                <div className="relative overflow-hidden rounded-[28px] border border-primary-100 bg-white/85 p-6 shadow-card backdrop-blur-2xl">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary-600" />
                    <p className="text-[0.92rem] font-bold tracking-tight text-primary-900">단가 근거</p>
                  </div>
                  <ul className="mt-3 space-y-2 text-[0.82rem] text-primary-900/70">
                    <li>· 한국물가협회 2026 Q1</li>
                    <li>· LH 표준 마감사양서</li>
                    <li>· G2B 실거래가 17K건</li>
                  </ul>
                  <p className="mt-3 text-[0.7rem] text-primary-900/40">분기별 자동 갱신 · 민간 판매가 미적용</p>
                </div>

                {/* 다음 */}
                <button
                  onClick={() => router.push("/workflow/bidding")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-500 px-4 py-3.5 text-sm font-semibold tracking-tight text-white shadow-cta hover:bg-primary-600"
                >
                  업체 매칭 입찰로 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* 하단 stepper */}
        <footer className="sticky bottom-6 z-30 mx-auto flex max-w-md items-center justify-center px-6 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 bg-white/85 px-4 py-2 backdrop-blur-md">
            {Array.from({ length: 5 }).map((_, i) => {
              const idx = i + 1;
              const active = idx === 4;
              const done = idx < 4;
              return (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    active ? "w-7 bg-primary-500" : done ? "w-3 bg-primary-300" : "w-3 bg-primary-100"
                  }`}
                />
              );
            })}
            <span className="ml-2 text-[0.7rem] font-semibold tabular text-primary-900/60">4/5</span>
          </div>
        </footer>
      </main>
    </LenisProvider>
  );
}

function CategoryGroup({
  cat,
  rows,
  updateQty,
}: {
  cat: string;
  rows: Row[];
  updateQty: (rowIndex: number, q: number) => void;
}) {
  const sum = rows.reduce((s, r) => s + Math.round(r.qty * r.unitPrice), 0);
  return (
    <>
      <tr className="bg-primary-50/30">
        <td colSpan={5} className="px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-widest text-primary-700">
          {cat}
        </td>
        <td className="px-3 py-1.5 text-right text-[0.78rem] font-bold tabular text-primary-700">
          ₩ {sum.toLocaleString()}
        </td>
      </tr>
      {rows.map((r, i) => (
        <motion.tr
          key={`${cat}-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-b border-primary-50 last:border-0"
        >
          <td className="px-3 py-2 align-middle">
            <p className="font-semibold tracking-tight text-primary-900">{r.item}</p>
            <p className="text-[0.7rem] text-primary-900/40">{r.source}</p>
          </td>
          <td className="px-3 py-2 align-middle text-[0.82rem] text-primary-900/70">{r.spec}</td>
          <td className="px-3 py-2 align-middle text-right">
            <input
              type="number"
              value={r.qty}
              onChange={(e) => updateQty(i, Number(e.target.value))}
              className="ml-auto block w-[4.5rem] rounded-md border border-primary-100 bg-white px-2 py-0.5 text-right text-[0.82rem] tabular leading-none text-primary-900 outline-none focus:border-primary-400"
              style={{ height: "1.6rem" }}
            />
          </td>
          <td className="px-3 py-2 align-middle text-[0.78rem] text-primary-900/60">{r.unit}</td>
          <td className="px-3 py-2 align-middle text-right tabular text-primary-900">
            ₩ {r.unitPrice.toLocaleString()}
          </td>
          <td className="px-3 py-2 align-middle text-right tabular font-semibold text-primary-900">
            ₩ {Math.round(r.qty * r.unitPrice).toLocaleString()}
          </td>
        </motion.tr>
      ))}
    </>
  );
}

function LockedButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      disabled
      className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-primary-200 bg-primary-50/40 px-3 py-2.5 text-[0.85rem] font-semibold text-primary-900/50"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <Lock className="h-3.5 w-3.5" />
    </button>
  );
}
