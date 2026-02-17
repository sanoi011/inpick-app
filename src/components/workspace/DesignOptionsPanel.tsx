"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, Sun, Crown, Minus, Leaf,
  DollarSign, Wallet, Gem,
  SunMedium, Archive, Footprints, Maximize, VolumeX, SprayCan,
  Dog, Baby, Accessibility, Monitor, Coffee, ArrowUpRight,
  ChevronDown, ChevronUp,
} from "lucide-react";
import type { DesignPreferences } from "@/types/consumer-project";

const STYLES = [
  { id: "모던", label: "모던", icon: Sparkles, desc: "깔끔한 직선과 무채색" },
  { id: "북유럽", label: "북유럽", icon: Sun, desc: "밝고 따뜻한 우드톤" },
  { id: "클래식", label: "클래식", icon: Crown, desc: "몰딩과 고급 소재" },
  { id: "미니멀", label: "미니멀", icon: Minus, desc: "군더더기 없는 심플" },
  { id: "내추럴", label: "내추럴", icon: Leaf, desc: "자연 소재 중심" },
];

const BUDGETS = [
  { id: "economy", label: "경제형", sub: "1,500만원", icon: DollarSign },
  { id: "standard", label: "표준형", sub: "3,000만원", icon: Wallet },
  { id: "premium", label: "프리미엄", sub: "5,000만원+", icon: Gem },
];

const PRIORITIES = [
  { id: "채광", label: "채광", icon: SunMedium },
  { id: "수납", label: "수납", icon: Archive },
  { id: "동선", label: "동선", icon: Footprints },
  { id: "개방감", label: "개방감", icon: Maximize },
  { id: "방음", label: "방음", icon: VolumeX },
  { id: "청소용이", label: "청소", icon: SprayCan },
];

const SPECIAL_NOTES = [
  { id: "반려동물", label: "반려동물", icon: Dog },
  { id: "어린이", label: "어린이", icon: Baby },
  { id: "노약자", label: "노약자", icon: Accessibility },
  { id: "홈오피스", label: "홈오피스", icon: Monitor },
  { id: "홈카페", label: "홈카페", icon: Coffee },
  { id: "확장형", label: "확장형", icon: ArrowUpRight },
];

interface Props {
  preferences: DesignPreferences;
  onChange: (prefs: DesignPreferences) => void;
}

export default function DesignOptionsPanel({ preferences, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [prefs, setPrefs] = useState<DesignPreferences>(preferences);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  const update = (partial: Partial<DesignPreferences>) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    onChange(next);
  };

  const toggleMulti = (field: "priorities" | "specialNotes", id: string) => {
    const arr = prefs[field];
    const next = arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id];
    update({ [field]: next });
  };

  return (
    <div className="border-t border-gray-200">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">디자인 옵션</span>
          {prefs.style && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
              {prefs.style}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-5">
          {/* 스타일 (단일 선택) */}
          <Section label="스타일">
            <div className="grid grid-cols-5 gap-1.5">
              {STYLES.map((s) => {
                const Icon = s.icon;
                const selected = prefs.style === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => update({ style: s.id })}
                    className="flex flex-col items-center gap-1 group"
                    title={s.desc}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm shadow-blue-200"
                          : "border-gray-200 bg-white text-gray-400 group-hover:border-gray-300 group-hover:text-gray-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        selected ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 예산 (단일 선택) */}
          <Section label="예산">
            <div className="grid grid-cols-3 gap-1.5">
              {BUDGETS.map((b) => {
                const Icon = b.icon;
                const selected = prefs.budget === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => update({ budget: b.id })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        selected
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        selected ? "text-blue-700" : "text-gray-600"
                      }`}
                    >
                      {b.label}
                    </span>
                    <span className="text-[9px] text-gray-400">{b.sub}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 우선순위 (복수 선택) */}
          <Section label="우선순위" multi>
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITIES.map((p) => {
                const Icon = p.icon;
                const selected = prefs.priorities.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleMulti("priorities", p.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                        selected
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-gray-200 bg-white text-gray-400 group-hover:border-gray-300"
                      }`}
                    >
                      {selected ? (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium ${
                        selected ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* 특기사항 (복수 선택) */}
          <Section label="특기사항" multi>
            <div className="grid grid-cols-3 gap-1.5">
              {SPECIAL_NOTES.map((s) => {
                const Icon = s.icon;
                const selected = prefs.specialNotes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleMulti("specialNotes", s.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                        selected
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-gray-200 bg-white text-gray-400 group-hover:border-gray-300"
                      }`}
                    >
                      {selected ? (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Icon className="w-3 h-3" />
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium ${
                        selected ? "text-violet-600" : "text-gray-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, multi, children }: { label: string; multi?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-gray-700">{label}</span>
        {multi && (
          <span className="text-[9px] text-gray-400">복수 선택</span>
        )}
      </div>
      {children}
    </div>
  );
}
