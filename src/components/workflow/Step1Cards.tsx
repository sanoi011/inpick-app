"use client";

import { motion } from "motion/react";
import { MapPin, Wallet, Layers, Check, ChevronDown } from "lucide-react";

const BUILDING_TYPES = [
  { v: "apartment", label: "아파트" },
  { v: "house", label: "주택" },
  { v: "store", label: "상가" },
  { v: "etc", label: "기타" },
];
const ROOMS = [
  { v: "living", label: "거실" },
  { v: "master", label: "안방" },
  { v: "kitchen", label: "부엌" },
  { v: "bath", label: "욕실" },
  { v: "bedroom", label: "침실" },
  { v: "entrance", label: "현관" },
];
const QUICK_BUDGETS = [1500, 3000, 5000];

export interface Step1Data {
  address: string;
  type: "basic" | "extended" | null;
  budget: number; // 단위: 만원
  buildingType: string | null;
  rooms: string[];
}

interface Props {
  value: Step1Data;
  onChange: (next: Step1Data) => void;
  onNext: () => void;
}

export default function Step1Cards({ value, onChange, onNext }: Props) {
  const update = <K extends keyof Step1Data>(k: K, v: Step1Data[K]) =>
    onChange({ ...value, [k]: v });

  const addressOk = value.address.length >= 3 && value.type !== null;
  const budgetOk = value.budget > 0;
  const scopeOk = value.buildingType !== null && value.rooms.length > 0;
  const allOk = addressOk && budgetOk && scopeOk;

  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:gap-7">
      {/* Card 1: 주소 */}
      <Card title="주소" icon={MapPin} done={addressOk}>
        <input
          type="text"
          value={value.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="아파트 단지 또는 도로명 주소"
          className="w-full rounded-xl border border-primary-100 bg-white/90 px-4 py-3 text-sm font-medium tracking-tight text-primary-900 outline-none placeholder:text-primary-900/30 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { v: "basic", label: "기본형" },
            { v: "extended", label: "확장형" },
          ].map((r) => {
            const sel = value.type === r.v;
            return (
              <button
                key={r.v}
                onClick={() => update("type", r.v as "basic" | "extended")}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {addressOk && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl bg-primary-50/70 p-3.5 text-[0.78rem] text-primary-900/70 ring-1 ring-primary-100"
          >
            <p className="font-bold tracking-tight text-primary-900">{value.address}</p>
            <p className="mt-1">전용 84.9㎡ · 방 3 · 욕실 2 · {value.type === "extended" ? "확장형" : "기본형"}</p>
          </motion.div>
        )}
      </Card>

      {/* Card 2: 예산 */}
      <Card title="예산 범위" icon={Wallet} done={budgetOk}>
        <p className="text-[2.6rem] font-extrabold tabular leading-none tracking-tightest">
          <span className="text-gradient-primary">{value.budget.toLocaleString()}</span>
          <span className="ml-1 text-base font-bold text-primary-600">만원</span>
        </p>
        <input
          type="range"
          min={500}
          max={10000}
          step={100}
          value={value.budget}
          onChange={(e) => update("budget", Number(e.target.value))}
          className="mt-5 w-full accent-primary-500"
        />
        <div className="mt-1 flex items-center justify-between text-[0.7rem] tabular text-primary-900/40">
          <span>500</span>
          <span>10,000</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {QUICK_BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => update("budget", b)}
              className={`rounded-full border px-3 py-1 text-[0.78rem] font-semibold tabular tracking-tight transition-all ${
                value.budget === b
                  ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                  : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
              }`}
            >
              {b.toLocaleString()}
            </button>
          ))}
        </div>
        {allOk && (
          <motion.button
            onClick={onNext}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-cta hover:bg-primary-600"
          >
            내 공간 꾸미기
            <ChevronDown className="h-3.5 w-3.5 animate-bounce-down" />
          </motion.button>
        )}
      </Card>

      {/* Card 3: 시공 범위 */}
      <Card title="시공 범위" icon={Layers} done={scopeOk}>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">건물 유형</p>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {BUILDING_TYPES.map((b) => {
            const sel = value.buildingType === b.v;
            return (
              <button
                key={b.v}
                onClick={() => update("buildingType", b.v)}
                className={`rounded-lg border px-2 py-2 text-[0.78rem] font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50">공사할 공간</p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {ROOMS.map((r) => {
            const sel = value.rooms.includes(r.v);
            return (
              <button
                key={r.v}
                onClick={() =>
                  update(
                    "rooms",
                    sel ? value.rooms.filter((x) => x !== r.v) : [...value.rooms, r.v]
                  )
                }
                className={`rounded-lg border px-2 py-2 text-[0.78rem] font-semibold tracking-tight transition-all ${
                  sel
                    ? "border-primary-500 bg-primary-500 text-white shadow-cta"
                    : "border-primary-100 bg-white/90 text-primary-900/70 hover:border-primary-300 hover:text-primary-900"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  done,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
      className={`relative overflow-hidden rounded-[28px] border bg-white/75 p-7 shadow-card backdrop-blur-2xl transition-all ${
        done
          ? "border-primary-400 shadow-card-hover"
          : "border-primary-100 hover:border-primary-200"
      }`}
    >
      {/* 카드 상단 살구 그라데이션 */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity ${
          done ? "opacity-100" : "opacity-50"
        }`}
        style={{
          background: "linear-gradient(90deg, transparent, #F73B20, transparent)",
        }}
      />
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2.5">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              done ? "bg-primary-500 text-white" : "bg-primary-50 text-primary-600"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-[0.92rem] font-bold tracking-tight text-primary-900">{title}</p>
        </div>
        {done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
