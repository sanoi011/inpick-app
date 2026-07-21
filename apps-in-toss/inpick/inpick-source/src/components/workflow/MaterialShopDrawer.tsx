"use client";

/**
 * 견적 자재 라인 → 실구매 상품 + 카탈로그 + 미리보기 연결 드로어.
 * 견적 페이지(전체 워크플로우)에서 자재명으로 열어 실제 구매 가능한 상품을 바로 비교한다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShoppingBag, X, ArrowRight, Sparkles, Search } from "lucide-react";

type ProductResult = {
  productId: string;
  title: string;
  image: string | null;
  price: number;
  mallName: string;
  link: string;
  brand?: string;
  sku?: string;
  spec?: string;
  source?: "internal" | "naver" | "mock";
};

type Surface = "floor" | "wall" | "ceiling" | "etc";

function inferSurface(q: string): Surface {
  if (/마루|바닥|장판|데코타일|폴리싱|LVT|SPC|타일.*바닥|바닥.*타일/i.test(q)) return "floor";
  if (/벽지|도배|타일|아트월|템바|스타코|월패널|포세린|필름|페인트|도장/i.test(q)) return "wall";
  if (/천장|천정|몰딩|루버|우물/i.test(q)) return "ceiling";
  return "etc";
}

export default function MaterialShopDrawer({
  materialName,
  onClose,
}: {
  materialName: string | null;
  onClose: () => void;
}) {
  const open = !!materialName;
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!materialName) return;
    let aborted = false;
    setLoading(true);
    setProducts([]);
    fetch(`/api/product-search?query=${encodeURIComponent(materialName)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!aborted) setProducts(d.products ?? []);
      })
      .catch(() => {
        if (!aborted) setProducts([]);
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [materialName]);

  if (!open) return null;
  const surface = inferSurface(materialName);
  const isArea = surface !== "etc";

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40"
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary-600">자재 · 실구매</p>
            <h3 className="truncate text-lg font-black tracking-tight text-zinc-900">{materialName}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-zinc-100 px-5 py-3">
          <Link
            href={`/partial-install?q=${encodeURIComponent(materialName)}`}
            className="inline-flex items-center gap-1 border border-zinc-300 px-2.5 py-1.5 text-xs font-bold text-zinc-700 hover:border-primary-400"
          >
            <Search className="h-3 w-3" /> 전체 카탈로그에서 보기
          </Link>
          {isArea && (
            <Link
              href={`/material-preview?surface=${surface}&mat=${encodeURIComponent(materialName)}`}
              className="inline-flex items-center gap-1 border border-primary-300 px-2.5 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-50"
            >
              <Sparkles className="h-3 w-3" /> 내 공간 미리보기
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-400">
              상품 결과가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <a
                  key={p.productId}
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col overflow-hidden border border-zinc-200 bg-white transition hover:shadow-md"
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden bg-zinc-100">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <ShoppingBag className="h-8 w-8 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <span
                      className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        p.source === "internal" ? "bg-primary-100 text-primary-700" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {p.mallName}
                    </span>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-zinc-700">{p.title}</p>
                    {(p.brand || p.sku) && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                        {p.brand}
                        {p.brand && p.sku ? " · " : ""}
                        {p.sku}
                      </p>
                    )}
                    <p className="mt-auto pt-1.5 text-sm font-black text-zinc-950">
                      {p.price > 0 ? (
                        <>
                          {p.price.toLocaleString()}
                          <span className="text-[11px] font-bold text-zinc-500">원~</span>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-zinc-500">가격 문의</span>
                      )}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-bold text-primary-600">
                      {p.source === "internal" ? "상품 보러가기" : "구매하러 가기"} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] leading-5 text-zinc-400">
            · 상품 가격은 쇼핑몰/카탈로그 참고가이며 실제 구매가와 다를 수 있습니다. 카드를 누르면 해당 쇼핑몰에서 구매할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
