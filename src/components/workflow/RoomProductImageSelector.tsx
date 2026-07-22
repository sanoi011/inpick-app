/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Search, Sparkles, X } from "lucide-react";

import {
  getRoomProductParts,
  type RoomCatalogProduct,
  type RoomProductCustomization,
  type RoomProductPartCode,
} from "@/lib/inpick/room-product-customization";

interface Props {
  imageUrl: string;
  value: RoomProductCustomization;
  onChange: (next: RoomProductCustomization) => void;
  searchCatalog: (
    partCode: RoomProductPartCode,
    query: string,
  ) => Promise<readonly RoomCatalogProduct[]>;
  onRegenerate: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const selectedLabel = (
  value: RoomProductCustomization,
  partCode: RoomProductPartCode,
) => {
  const product = value.selections[partCode]?.product;
  return product ? [product.brand, product.sku].filter(Boolean).join(" · ") : "SKU 선택";
};

export default function RoomProductImageSelector({
  imageUrl,
  value,
  onChange,
  searchCatalog,
  onRegenerate,
  disabled = false,
  className = "",
}: Props) {
  const definitions = getRoomProductParts(value.roomKind);
  const [activePart, setActivePart] = useState<RoomProductPartCode | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly RoomCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const requestSequence = useRef(0);

  const activeDefinition = definitions.find((part) => part.partCode === activePart);
  const selectedDefinitions = definitions.filter((part) => value.selections[part.partCode]);

  const loadProducts = async (partCode: RoomProductPartCode, searchText: string) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const products = await searchCatalog(partCode, searchText.trim());
      if (requestSequence.current === requestId) setResults(products);
    } catch {
      if (requestSequence.current === requestId) {
        setResults([]);
        setError("검증 상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  };

  const openPart = (partCode: RoomProductPartCode) => {
    if (disabled) return;
    setActivePart(partCode);
    setQuery("");
    setResults([]);
    setError(null);
    void loadProducts(partCode, "");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activePart) void loadProducts(activePart, query);
  };

  const chooseProduct = (product: RoomCatalogProduct) => {
    if (!activePart || !product.sku || !product.provenance.verifiedAt) return;
    onChange({
      ...value,
      selections: {
        ...value.selections,
        [activePart]: { partCode: activePart, product },
      },
    });
    setActivePart(null);
    setResults([]);
    setQuery("");
  };

  const removeProduct = (partCode: RoomProductPartCode) => {
    const selections = { ...value.selections };
    delete selections[partCode];
    onChange({ ...value, selections });
  };

  const regenerate = async () => {
    if (regenerating || selectedDefinitions.length === 0) return;
    setRegenerating(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "제품 적용 이미지 생성에 실패했습니다.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section
      aria-label={`${value.roomName} 실제 제품 선택`}
      className={`rounded-[28px] border border-black/10 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black/45">
            Image-based product restyle
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-black">
            {value.roomName} · 이미지에서 실제 제품 선택
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
            1차 생성 이미지를 기준으로 화살표의 부위를 선택하세요. 검증된 모델번호가 있는 SKU만 표시하고,
            선택 후 같은 이미지 구도에서 제품 기준 재시안을 생성합니다.
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/65">
          선택 {selectedDefinitions.length}/{definitions.length}
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <div className="relative aspect-square overflow-hidden rounded-[24px] border border-black/10 bg-white">
          <img src={imageUrl} alt={`${value.roomName} 1차 생성 이미지`} className="absolute inset-0 h-full w-full object-contain" />
          <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <marker id={`arrow-${value.roomId.replace(/[^a-zA-Z0-9_-]/g, "-")}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 z" fill="rgba(0,0,0,.78)" />
              </marker>
            </defs>
            {definitions.map((part) => (
              <g key={part.partCode}>
                <line
                  x1={part.label.x}
                  y1={part.label.y}
                  x2={part.target.x}
                  y2={part.target.y}
                  stroke="rgba(255,255,255,.94)"
                  strokeWidth="1.25"
                />
                <line
                  x1={part.label.x}
                  y1={part.label.y}
                  x2={part.target.x}
                  y2={part.target.y}
                  stroke="rgba(0,0,0,.78)"
                  strokeWidth="0.45"
                  markerEnd={`url(#arrow-${value.roomId.replace(/[^a-zA-Z0-9_-]/g, "-")})`}
                />
                <circle cx={part.target.x} cy={part.target.y} r="1.2" fill="white" stroke="black" strokeWidth="0.45" />
              </g>
            ))}
          </svg>

          {definitions.map((part) => {
            const selected = Boolean(value.selections[part.partCode]);
            return (
              <button
                key={part.partCode}
                type="button"
                disabled={disabled || regenerating}
                aria-pressed={activePart === part.partCode}
                onClick={() => openPart(part.partCode)}
                style={{ left: `${part.label.x}%`, top: `${part.label.y}%`, transform: "translate(-50%, -50%)" }}
                className={`absolute z-10 max-w-[8.2rem] rounded-xl border px-2.5 py-2 text-left shadow-lg backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50 ${
                  selected
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white/95 text-black hover:border-black"
                }`}
              >
                <span className="flex items-center gap-1 text-[0.68rem] font-extrabold sm:text-xs">
                  {selected ? <Check className="h-3 w-3 shrink-0" /> : null}
                  {part.labelKo}
                </span>
                <span className={`mt-0.5 block truncate text-[0.55rem] sm:text-[0.62rem] ${selected ? "text-white/70" : "text-black/48"}`}>
                  {selectedLabel(value, part.partCode)}
                </span>
              </button>
            );
          })}
        </div>

        <aside className="rounded-[24px] border border-black/10 bg-white p-4 sm:p-5">
          {activeDefinition ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-black/45">선택 부위</p>
                  <h3 className="mt-1 text-lg font-extrabold text-black">{activeDefinition.labelKo}</h3>
                  <p className="mt-1 text-xs leading-5 text-black/55">{activeDefinition.helpKo}</p>
                </div>
                <button type="button" onClick={() => setActivePart(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white" aria-label="제품 선택 닫기">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={submitSearch} className="mt-4 flex gap-2" role="search">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                  <span className="sr-only">제품명, 브랜드 또는 SKU</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="제품명 · 브랜드 · SKU"
                    className="w-full rounded-xl border border-black/15 bg-white py-2.5 pl-9 pr-3 text-sm text-black outline-none focus:border-black"
                  />
                </label>
                <button type="submit" disabled={loading} className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  검색
                </button>
              </form>

              {loading ? (
                <div role="status" className="mt-6 flex items-center justify-center gap-2 text-sm text-black/55">
                  <Loader2 className="h-4 w-4 animate-spin" /> 검증 SKU 조회 중
                </div>
              ) : null}
              {!loading && !error && results.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-black/15 bg-white p-4 text-xs leading-5 text-black/50">
                  이 부위에 연결된 검증 SKU가 없습니다. 임의 상품이나 가상 모델명은 표시하지 않습니다.
                </p>
              ) : null}
              <ul className="mt-4 max-h-[30rem] space-y-2 overflow-y-auto pr-1">
                {results.map((product) => (
                  <li key={product.materialProductId}>
                    <button type="button" onClick={() => chooseProduct(product)} className="flex w-full gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left transition hover:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
                      {product.thumbnailUrl ? (
                        <img src={product.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-black/5 object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white text-[0.6rem] text-black/35">이미지 없음</div>
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold text-black">{product.displayName}</span>
                        <span className="mt-1 block truncate text-xs font-bold text-black/65">{[product.brand, product.sku].filter(Boolean).join(" · ")}</span>
                        <span className="mt-1 block line-clamp-2 text-[0.68rem] leading-4 text-black/45">{product.spec || "규격 정보 없음"}</span>
                        <span className="mt-1.5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-800">SKU 검증 · {product.provenance.verifiedAt?.slice(0, 10)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-base font-extrabold text-black">선택한 제품</h3>
              {selectedDefinitions.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-4 text-sm leading-6 text-black/52">이미지 위 화살표를 눌러 변경할 부위를 먼저 선택하세요.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {selectedDefinitions.map((part) => {
                    const product = value.selections[part.partCode]!.product;
                    return (
                      <li key={part.partCode} className="rounded-xl border border-black/10 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[0.65rem] font-bold text-black/45">{part.labelKo}</span>
                            <strong className="mt-0.5 block truncate text-sm text-black">{product.displayName}</strong>
                            <span className="mt-0.5 block truncate text-xs text-black/55">{[product.brand, product.sku].filter(Boolean).join(" · ")}</span>
                          </div>
                          <button type="button" onClick={() => removeProduct(part.partCode)} className="shrink-0 text-xs font-semibold text-black/45 underline">삭제</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <footer className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-5 text-black/48">
          실제 SKU 정보가 프롬프트와 견적에 연결됩니다. 생성 이미지는 제품 사실을 기준으로 한 시각적 재시안이며 제조품의 픽셀 단위 동일성을 보증하지 않습니다.
        </p>
        <button
          type="button"
          disabled={disabled || regenerating || selectedDefinitions.length === 0}
          onClick={() => void regenerate()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-extrabold text-white transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {regenerating ? "image-2 재생성 중" : "선택 SKU로 이미지 재생성"}
          {!regenerating ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </footer>
    </section>
  );
}
