"use client";

import { Search, X } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filters?: FilterOption[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  placeholder = "검색...",
  filters = [],
  activeFilter,
  onFilterChange,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/32" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-black/[0.08] bg-white py-2.5 pl-10 pr-9 text-sm outline-none transition focus:border-black/40"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/65"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === f.value
                  ? "bg-[#0d0d0d] text-white"
                  : "bg-white text-black/55 hover:bg-black/[0.05]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
