"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { TRADE_OPTIONS, REGION_OPTIONS, SORT_OPTIONS, CONTRACTOR_TYPE_LABELS } from "@/types/contractor-directory";
import type { ContractorType } from "@/types/contractor-directory";

interface ContractorFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  type: ContractorType | "all";
  onTypeChange: (v: ContractorType | "all") => void;
  trade: string;
  onTradeChange: (v: string) => void;
  region: string;
  onRegionChange: (v: string) => void;
  minRating: number;
  onMinRatingChange: (v: number) => void;
  sort: string;
  onSortChange: (v: string) => void;
}

const TYPE_TABS: { label: string; value: ContractorType | "all" }[] = [
  { label: "전체", value: "all" },
  { label: CONTRACTOR_TYPE_LABELS.general, value: "general" },
  { label: CONTRACTOR_TYPE_LABELS.specialty, value: "specialty" },
];

const RATING_OPTIONS = [
  { value: 0, label: "전체" },
  { value: 3, label: "3.0 이상" },
  { value: 4, label: "4.0 이상" },
  { value: 4.5, label: "4.5 이상" },
];

export function ContractorFilters(props: ContractorFiltersProps) {
  return (
    <div className="space-y-3">
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="업체명으로 검색..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 유형 탭 */}
      <div className="flex gap-1.5">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => props.onTypeChange(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              props.type === tab.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 필터 드롭다운 */}
      <div className="flex flex-wrap gap-2 items-center">
        <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />

        <select
          value={props.region}
          onChange={(e) => props.onRegionChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">지역 전체</option>
          {REGION_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <select
          value={props.trade}
          onChange={(e) => props.onTradeChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">공종 전체</option>
          {TRADE_OPTIONS.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
        </select>

        <select
          value={props.minRating}
          onChange={(e) => props.onMinRatingChange(Number(e.target.value))}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {RATING_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label === "전체" ? "평점 전체" : `★ ${r.label}`}</option>
          ))}
        </select>

        <div className="flex-1" />

        <select
          value={props.sort}
          onChange={(e) => props.onSortChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
