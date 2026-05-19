"use client";

/**
 * TokenPurchaseDrawer
 *
 * 사용자가 토큰을 충전하는 드로어.
 * - Step2 토큰 부족 시 자동 열림
 * - /mypage/billing "충전하기" 버튼으로도 열림
 *
 * 흐름:
 *   1. mount 시 /api/billing/products 호출 → active pricing version + visible products
 *   2. 패키지 선택
 *   3. /api/payments/checkout 호출 → mockMode면 즉시 지급, production은 Toss SDK 호출 흐름 분기
 *   4. 지급 완료 시 onProvisioned 콜백
 *
 * 가이드: INPICK_BILLING_CHECKOUT_ADMIN_PRICING_DEV_PLAN_20260519.md §10
 */
import { useEffect, useState } from "react";
import { X, Loader2, Coins, Sparkles, AlertCircle, Star } from "lucide-react";

type Product = {
  productId: string;
  productType: string;
  displayName: string;
  description: string | null;
  amountKrw: number;
  tokenAmount: number | null;
  bonusTokenAmount: number | null;
  totalTokenAmount: number | null;
  effectiveUnitPriceKrw: number | null;
  isPopular: boolean;
};

type BillingProducts = {
  pricing: {
    pricingVersionId: string;
    baseTokenUnitPriceKrw: number;
    imageGenerationTokenCost: number;
    signupBonusTokens: number;
    pdfSinglePriceKrw: number;
  } | null;
  products: Product[];
  providerMode: "toss_live" | "toss_test" | "mock";
};

export interface TokenPurchaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  reason?: "step2_image_generation" | "manual_topup";
  requiredTokens?: number;
  currentTokens?: number;
  onProvisioned?: () => void;
}

export function TokenPurchaseDrawer({
  open,
  onOpenChange,
  projectId,
  reason = "manual_topup",
  requiredTokens,
  currentTokens,
  onProvisioned,
}: TokenPurchaseDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BillingProducts | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/billing/products", { cache: "no-store" });
        if (!res.ok) {
          setErrorMsg("상품 목록을 불러오지 못했습니다");
          return;
        }
        const d = (await res.json()) as BillingProducts;
        if (cancelled) return;
        setData(d);
        // 자동 추천 선택 — 토큰 부족 시 requiredTokens 채우는 최소 패키지
        if (requiredTokens && currentTokens !== undefined) {
          const need = Math.max(0, requiredTokens - currentTokens);
          if (need > 0) {
            const tokenPacks = d.products.filter((p) => p.productType.includes("token") || p.productType.includes("credit"));
            const sorted = [...tokenPacks].sort((a, b) => (a.totalTokenAmount ?? 0) - (b.totalTokenAmount ?? 0));
            const enough = sorted.find((p) => (p.totalTokenAmount ?? 0) >= need);
            setSelectedId((enough ?? sorted[0])?.productId ?? null);
            return;
          }
        }
        // 기본: 인기 상품 또는 두 번째 패키지
        const popular = d.products.find((p) => p.isPopular);
        setSelectedId((popular ?? d.products[0])?.productId ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, requiredTokens, currentTokens]);

  const handlePurchase = async () => {
    if (!selectedId) return;
    setPurchasing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: selectedId,
          projectId,
          returnPath: typeof window !== "undefined" ? window.location.pathname : "/mypage/billing",
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setErrorMsg(result.hint || result.error || "결제 생성 실패");
        return;
      }

      // Mock 모드: 즉시 지급된 상태
      if (result.mockMode) {
        setSuccessMsg(`충전 완료! +${result.creditsAdded ?? 0}토큰`);
        onProvisioned?.();
        setTimeout(() => onOpenChange(false), 1200);
        return;
      }

      // Production: Toss Widget 호출 필요
      // (현재 Toss SDK 통합은 후속 작업 — clientKey가 환경변수에 있을 때만 작동)
      if (result.clientKey && result.successUrl) {
        // 임시: Toss 결제 페이지로 redirect (SDK 통합은 후속)
        setErrorMsg("Toss SDK 통합은 다음 배포에서 활성화됩니다. 현재는 Mock 모드만 동작합니다.");
        return;
      }
      setErrorMsg("결제 처리 흐름이 설정되지 않았습니다");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "결제 실패");
    } finally {
      setPurchasing(false);
    }
  };

  if (!open) return null;

  const tokenPacks = (data?.products ?? []).filter((p) => p.totalTokenAmount && p.totalTokenAmount > 0);
  const pdfProducts = (data?.products ?? []).filter((p) => p.productType.includes("pdf"));
  const selected = data?.products.find((p) => p.productId === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => !purchasing && onOpenChange(false)}>
      <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-orange-500" /> 토큰 충전
            </h2>
            {reason === "step2_image_generation" && requiredTokens !== undefined && (
              <p className="mt-1 text-sm text-gray-600">
                AI 디자인 이미지 1장 생성에는 {data?.pricing?.imageGenerationTokenCost ?? 1}토큰이 필요합니다.
                {currentTokens !== undefined && (
                  <>
                    {" "}현재 보유: <span className="font-semibold">{currentTokens}토큰</span>
                  </>
                )}
              </p>
            )}
          </div>
          <button onClick={() => onOpenChange(false)} disabled={purchasing} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !data || tokenPacks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">충전 가능한 상품이 없습니다</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* 패키지 grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tokenPacks.map((p) => (
                <button
                  key={p.productId}
                  onClick={() => setSelectedId(p.productId)}
                  className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                    selectedId === p.productId
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {p.isPopular && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-white bg-orange-500 rounded-full">
                      <Star className="w-2.5 h-2.5" /> 인기
                    </span>
                  )}
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-gray-900">{p.displayName}</p>
                    <p className="text-xl font-bold text-gray-900">{p.amountKrw.toLocaleString()}원</p>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-orange-600">{p.totalTokenAmount}</span>
                    <span className="text-xs text-gray-500">토큰</span>
                    {p.bonusTokenAmount ? (
                      <span className="ml-1 text-[11px] font-medium text-amber-700">+{p.bonusTokenAmount} 보너스</span>
                    ) : null}
                  </div>
                  {p.effectiveUnitPriceKrw && (
                    <p className="mt-1 text-[11px] text-gray-500">실질 단가: {p.effectiveUnitPriceKrw.toLocaleString()}원/토큰</p>
                  )}
                </button>
              ))}
            </div>

            {/* PDF 발급권 (있으면) */}
            {pdfProducts.length > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs font-semibold text-emerald-900">견적서 PDF 발급권도 별도 구매 가능</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">/mypage/billing의 PDF 탭에서 구매하세요</p>
              </div>
            )}

            {/* 에러/성공 */}
            {errorMsg && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {successMsg}
              </div>
            )}

            {/* 구매 버튼 */}
            <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-white border-t flex items-center justify-between gap-3">
              <div className="text-sm">
                {selected ? (
                  <>
                    <span className="text-gray-500">결제 금액</span>{" "}
                    <span className="font-bold text-gray-900 text-base">{selected.amountKrw.toLocaleString()}원</span>
                  </>
                ) : (
                  <span className="text-gray-400">패키지를 선택하세요</span>
                )}
              </div>
              <button
                onClick={handlePurchase}
                disabled={purchasing || !selectedId}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-full shadow-cta hover:bg-orange-600 disabled:bg-gray-300 disabled:shadow-none"
              >
                {purchasing && <Loader2 className="w-4 h-4 animate-spin" />}
                {data.providerMode === "mock" ? "충전 (Mock)" : "결제하기"}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              {data.providerMode === "mock"
                ? "현재 Mock 모드 — 즉시 충전됩니다 (Toss 입점 심사 중)"
                : data.providerMode === "toss_live"
                ? "실결제 모드 — 토스페이먼츠"
                : "테스트 모드 — Toss test 키"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
