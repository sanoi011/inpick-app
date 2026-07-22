"use client";

import React, { FormEvent, useRef, useState } from "react";

import {
  KITCHEN_PART_DEFINITIONS,
  type KitchenAssembly,
  type KitchenCatalogProduct,
  type KitchenPartCode,
} from "@/lib/inpick/kitchen-assembly";

export interface KitchenAssemblySelectorProps {
  value: KitchenAssembly;
  onChange: (next: KitchenAssembly) => void;
  searchCatalog: (
    partCode: KitchenPartCode,
    query: string,
  ) => Promise<readonly KitchenCatalogProduct[]>;
  disabled?: boolean;
  className?: string;
}

const CALLOUT_POSITION: Record<KitchenPartCode, string> = {
  upper_cabinet: "left-2 top-4",
  lower_cabinet: "right-2 top-4",
  countertop: "left-2 top-[22%]",
  backsplash: "right-2 top-[22%]",
  sink_bowl: "left-2 top-[40%]",
  faucet: "right-2 top-[40%]",
  fridge_cabinet: "left-2 top-[58%]",
  kimchi_fridge_cabinet: "right-2 top-[58%]",
  hood: "left-2 top-[76%]",
  cooktop: "right-2 top-[76%]",
};

const selectedText = (assembly: KitchenAssembly, partCode: KitchenPartCode) => {
  const product = assembly.selections[partCode]?.product;
  if (!product) return "제품 선택";
  return [product.brand, product.sku ?? product.spec].filter(Boolean).join(" · ") || "카탈로그 제품 선택됨";
};

export default function KitchenAssemblySelector({
  value,
  onChange,
  searchCatalog,
  disabled = false,
  className = "",
}: KitchenAssemblySelectorProps) {
  const [activePart, setActivePart] = useState<KitchenPartCode | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly KitchenCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const openPart = (partCode: KitchenPartCode) => {
    if (disabled) return;
    requestSequence.current += 1;
    setActivePart(partCode);
    setQuery("");
    setResults([]);
    setError(null);
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activePart || !query.trim()) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const catalogRows = await searchCatalog(activePart, query.trim());
      if (requestSequence.current === requestId) setResults(catalogRows);
    } catch {
      if (requestSequence.current === requestId) {
        setResults([]);
        setError("카탈로그 검색에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  };

  const chooseProduct = (product: KitchenCatalogProduct) => {
    if (!activePart) return;
    onChange({
      ...value,
      selections: {
        ...value.selections,
        [activePart]: {
          partCode: activePart,
          quantity: value.selections[activePart]?.quantity,
          product: {
            materialProductId: product.materialProductId,
            brand: product.brand,
            sku: product.sku,
            spec: product.spec,
            unitPrice: product.unitPrice,
            provenance: { ...product.provenance },
          },
        },
      },
    });
    setActivePart(null);
    setResults([]);
    setQuery("");
  };

  const removeProduct = (partCode: KitchenPartCode) => {
    const selections = { ...value.selections };
    delete selections[partCode];
    onChange({ ...value, selections });
  };

  const activeDefinition = KITCHEN_PART_DEFINITIONS.find(
    (definition) => definition.partCode === activePart,
  );
  const selectedDefinitions = KITCHEN_PART_DEFINITIONS.filter(
    (definition) => value.selections[definition.partCode],
  );

  return (
    <section
      aria-label="주방 조립 부품 선택"
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Kitchen assembly</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">부품별 실제 제품 선택</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          주방 도식에서 부품을 고른 뒤 연결된 카탈로그를 검색하세요. SKU가 없는 제품에는 임의 모델명을 붙이지 않습니다.
        </p>
      </header>

      <div className="relative mt-5 h-[31rem] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-50 to-orange-50/60 sm:h-[34rem]">
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 180 260" className="h-72 w-48 text-slate-400 sm:h-80" fill="none">
            <rect x="28" y="28" width="124" height="50" rx="8" fill="currentColor" opacity=".18" />
            <path d="M35 91h110M45 91v100m90-100v100M25 191h130v40H25z" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
            <path d="M70 112h42v23H70zM116 106h13v24h-13M82 91v-18c0-13 20-13 20 0" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="91" cy="124" r="3" fill="currentColor" />
          </svg>
        </div>

        {KITCHEN_PART_DEFINITIONS.map((definition) => {
          const selected = Boolean(value.selections[definition.partCode]);
          return (
            <button
              key={definition.partCode}
              type="button"
              disabled={disabled}
              aria-pressed={activePart === definition.partCode}
              onClick={() => openPart(definition.partCode)}
              className={`absolute z-10 w-[8.25rem] rounded-2xl border px-2.5 py-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-40 ${CALLOUT_POSITION[definition.partCode]} ${
                selected
                  ? "border-orange-300 bg-orange-50 text-orange-950"
                  : "border-slate-200 bg-white/95 text-slate-800 hover:border-orange-300"
              }`}
            >
              <span className="block text-xs font-bold sm:text-sm">{definition.labelKo}</span>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500 sm:text-xs">
                {selectedText(value, definition.partCode)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 p-3">
        <h3 className="text-sm font-bold text-slate-900">접근 가능한 부품 목록</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {KITCHEN_PART_DEFINITIONS.map((definition) => (
            <li key={definition.partCode} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{definition.labelKo}</span>
                <span className="block truncate text-xs text-slate-500">
                  {selectedText(value, definition.partCode)}
                </span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => openPart(definition.partCode)}
                className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"
              >
                {value.selections[definition.partCode] ? "변경" : "선택"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {activePart && activeDefinition ? (
        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-950">{activeDefinition.labelKo} 카탈로그 검색</h3>
            <button type="button" onClick={() => setActivePart(null)} className="text-sm text-slate-600 underline">
              닫기
            </button>
          </div>
          <form onSubmit={submitSearch} className="mt-3 flex gap-2" role="search">
            <label htmlFor={`kitchen-catalog-${activePart}`} className="sr-only">
              {activeDefinition.labelKo} 제품명, 브랜드 또는 SKU
            </label>
            <input
              id={`kitchen-catalog-${activePart}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제품명, 브랜드 또는 SKU"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              검색
            </button>
          </form>
          {loading ? <p role="status" className="mt-3 text-sm text-slate-600">카탈로그 검색 중…</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
          {!loading && !error && results.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">검색 결과는 연결된 카탈로그 응답만 표시됩니다.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {results.map((product) => (
              <li key={product.materialProductId}>
                <button
                  type="button"
                  onClick={() => chooseProduct(product)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <span className="block text-sm font-bold text-slate-900">{product.displayName}</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {[product.brand, product.sku, product.spec].filter(Boolean).join(" · ") || "모델 정보 없음"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5" aria-live="polite">
        <h3 className="text-sm font-bold text-slate-900">선택 요약 ({selectedDefinitions.length}/10)</h3>
        {selectedDefinitions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">선택된 카탈로그 제품이 없습니다.</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {selectedDefinitions.map((definition) => {
              const selection = value.selections[definition.partCode]!;
              return (
                <li key={definition.partCode} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-500">{definition.labelKo}</span>
                      <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">
                        {[selection.product.brand, selection.product.sku].filter(Boolean).join(" · ") || selection.product.materialProductId}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeProduct(definition.partCode)}
                      className="text-xs text-slate-500 underline disabled:opacity-50"
                      aria-label={`${definition.labelKo} 선택 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
