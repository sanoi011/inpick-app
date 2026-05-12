/**
 * MaterialLibraryDrawer — 선택된 layer에 자재 후보 표시 + 적용.
 *
 * 가이드: c:\Users\user\Desktop\inpick-mode-separated-ai-pipeline-dev-plan-20260512.md §9
 *
 * 동작:
 *  - selectedLayer.surfaceType 기반 material_products 검색
 *  - 검색어 입력 / 등급 필터
 *  - 카드 클릭 → preview (texture warp 또는 image edit) 호출 (옵션)
 *  - "적용" 버튼 → /api/inpick/editable-render/material-apply 호출
 */
"use client";

import { useEffect, useState } from "react";
import {
  X,
  Search,
  Loader2,
  CheckCircle2,
  Award,
  ShieldCheck,
} from "lucide-react";
import {
  surfaceTypeLabelKo,
  type EditableRenderLayer,
} from "@/lib/inpick/editable-render/types";

interface MaterialProduct {
  id: string;
  brand: string;
  productName: string;
  modelNumber?: string;
  specification?: string;
  retailPrice?: number;
  contractorPrice?: number;
  unit?: string;
  priceGrade?: "economy" | "standard" | "premium";
  thumbnailUrl?: string;
  isVerified?: boolean;
  categoryCode?: string;
}

interface Props {
  editableRenderId?: string;
  selectedLayer: EditableRenderLayer | null;
  onClose: () => void;
  onApplied?: (input: {
    layerId: string;
    productId: string;
    materialLabel: string;
  }) => void;
}

export default function MaterialLibraryDrawer({
  editableRenderId,
  selectedLayer,
  onClose,
  onApplied,
}: Props) {
  const [products, setProducts] = useState<MaterialProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<"" | "economy" | "standard" | "premium">("");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLayer) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("surfaceType", selectedLayer.surfaceType);
    if (query) params.set("q", query);
    if (grade) params.set("grade", grade);
    params.set("limit", "24");

    fetch(`/api/inpick/material-search?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.products) setProducts(data.products);
        else setProducts([]);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[material-drawer] search error", e);
        setError("자재 검색에 실패했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLayer, query, grade]);

  const handleApply = async (product: MaterialProduct) => {
    if (!selectedLayer || !editableRenderId) return;
    setApplyingId(product.id);
    setError(null);
    try {
      const res = await fetch("/api/inpick/editable-render/material-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editableRenderId,
          layerId: selectedLayer.id,
          materialProductId: product.id,
          method: "texture_warp",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.hint || data.error || "자재 적용 실패");
        return;
      }
      onApplied?.({
        layerId: selectedLayer.id,
        productId: product.id,
        materialLabel:
          data.materialLabel || `${product.brand} ${product.productName}`,
      });
    } catch (e) {
      console.error("[material-drawer] apply error", e);
      setError("적용 중 오류가 발생했습니다.");
    } finally {
      setApplyingId(null);
    }
  };

  if (!selectedLayer) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl border-l border-gray-200">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            {surfaceTypeLabelKo(selectedLayer.surfaceType)}
          </p>
          <h3 className="text-base font-bold tracking-tight text-gray-900">
            {selectedLayer.labelKo}
          </h3>
          {selectedLayer.materialLabel && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              현재: {selectedLayer.materialLabel}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="px-5 py-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="브랜드 또는 제품명 검색"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary-400"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { v: "" as const, label: "전체 등급" },
            { v: "economy" as const, label: "보급형" },
            { v: "standard" as const, label: "표준" },
            { v: "premium" as const, label: "프리미엄" },
          ].map((g) => (
            <button
              key={g.v}
              type="button"
              onClick={() => setGrade(g.v)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                grade === g.v
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-primary-300"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* 제품 카드 그리드 */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-[11px] text-gray-400">
            검색 결과가 없습니다.
            <br />
            다른 키워드를 시도해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {products.map((p) => {
              const isApplying = applyingId === p.id;
              const isApplied =
                selectedLayer.materialProductId === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border bg-white p-2 transition-all ${
                    isApplied
                      ? "border-emerald-400 ring-1 ring-emerald-200"
                      : "border-gray-200 hover:border-primary-300 hover:shadow-sm"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt={p.productName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-gray-300">
                        no image
                      </div>
                    )}
                    {p.isVerified && (
                      <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        검증
                      </span>
                    )}
                    {p.priceGrade === "premium" && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        <Award className="h-2.5 w-2.5" />
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 truncate">
                      {p.brand}
                    </p>
                    <p
                      className="text-[11px] font-bold text-gray-900 truncate"
                      title={p.productName}
                    >
                      {p.productName}
                    </p>
                    {p.modelNumber && (
                      <p className="text-[9px] text-gray-500 truncate">
                        {p.modelNumber}
                      </p>
                    )}
                    {p.retailPrice && (
                      <p className="mt-0.5 text-[10px] font-semibold text-gray-700">
                        ₩{p.retailPrice.toLocaleString()}
                        <span className="text-[9px] font-normal text-gray-500">
                          {" "}
                          / {p.unit || "EA"}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApply(p)}
                    disabled={isApplying || isApplied}
                    className={`mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full py-1 text-[10px] font-semibold transition-colors ${
                      isApplied
                        ? "bg-emerald-50 text-emerald-700 cursor-default"
                        : "bg-primary-500 text-white hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400"
                    }`}
                  >
                    {isApplying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isApplied ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        적용됨
                      </>
                    ) : (
                      "적용"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
