import { useEffect, useState } from "react";
import { AlertCircle, Coins, Loader2, Sparkles, Star, X } from "lucide-react";
import { purchaseWithAppsInTossPay } from "./apps-in-toss-pay";

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
  pricing: { imageGenerationTokenCost: number } | null;
  products: Product[];
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/billing/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("상품 목록을 불러오지 못했습니다.");
        return (await response.json()) as BillingProducts;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        const packs = payload.products
          .filter((product) => (product.totalTokenAmount || 0) > 0)
          .sort((a, b) => (a.totalTokenAmount || 0) - (b.totalTokenAmount || 0));
        const need = Math.max(0, (requiredTokens || 0) - (currentTokens || 0));
        const recommended =
          (need > 0
            ? packs.find((product) => (product.totalTokenAmount || 0) >= need)
            : packs.find((product) => product.isPopular)) || packs[0];
        setSelectedId(recommended?.productId || null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "상품 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requiredTokens, currentTokens]);

  if (!open) return null;
  const tokenPacks = (data?.products || []).filter(
    (product) => (product.totalTokenAmount || 0) > 0,
  );
  const selected = tokenPacks.find((product) => product.productId === selectedId);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await purchaseWithAppsInTossPay({
        productCode: selected.productId,
        projectId,
        returnPath: "/workflow",
      });
      if (result.testMode) {
        setSuccess(result.message || "샌드박스 결제 인증 테스트가 완료됐습니다.");
        return;
      }
      if (result.ok && result.provisioned) {
        setSuccess(
          `충전 완료! +${result.creditsAdded ?? selected.totalTokenAmount ?? 0}토큰`,
        );
        onProvisioned?.();
        window.setTimeout(() => onOpenChange(false), 1_200);
        return;
      }
      if (!result.cancelled) {
        setError(result.error || "앱인토스 페이 결제를 완료하지 못했습니다.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={() => !purchasing && onOpenChange(false)}
    >
      <section
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 flex items-start justify-between border-b bg-white p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Coins className="h-5 w-5 text-orange-500" /> 토큰 충전
            </h2>
            {reason === "step2_image_generation" ? (
              <p className="mt-1 text-sm text-gray-600">
                AI 이미지 생성에는 {data?.pricing?.imageGenerationTokenCost || 1}토큰이 필요해요.
                {currentTokens !== undefined ? ` 현재 보유 ${currentTokens}토큰` : ""}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={purchasing}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tokenPacks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">충전 가능한 상품이 없습니다.</div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tokenPacks.map((product) => (
                <button
                  key={product.productId}
                  onClick={() => setSelectedId(product.productId)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    selectedId === product.productId
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {product.isPopular ? (
                    <span className="absolute -right-2 -top-2 inline-flex items-center gap-0.5 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      <Star className="h-2.5 w-2.5" /> 인기
                    </span>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{product.displayName}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {product.amountKrw.toLocaleString()}원
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-orange-600">
                    {product.totalTokenAmount}
                    <span className="ml-1 text-xs font-normal text-gray-500">토큰</span>
                  </p>
                  {product.bonusTokenAmount ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      +{product.bonusTokenAmount} 보너스 포함
                    </p>
                  ) : null}
                </button>
              ))}
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            ) : null}
            {success ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <Sparkles className="h-4 w-4" /> {success}
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t bg-white px-5 py-3">
              <p className="text-sm text-gray-500">
                결제 금액{" "}
                <strong className="text-base text-gray-900">
                  {selected ? `${selected.amountKrw.toLocaleString()}원` : "—"}
                </strong>
              </p>
              <button
                onClick={handlePurchase}
                disabled={purchasing || !selected}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:bg-gray-300"
              >
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                토스페이로 결제
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-400">
              토스 앱 안에서 앱인토스 페이로만 안전하게 결제됩니다.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
