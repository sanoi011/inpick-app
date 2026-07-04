"use client";

/**
 * EstimatePdfPurchaseModal — 견적서 PDF 다운로드 결제 모달.
 * 가이드: 2026-05-14 pricing v2 — 9,900원 (부가세 포함) 단발 결제
 *
 * 흐름:
 *   1. props.open=true 시 표시
 *   2. POST /api/payments/checkout (productCode=estimate_pdf_single, estimateId)
 *   3. mockMode=true 면 즉시 entitlement 발급 → onPaid({ entitlementId })
 *   4. mockMode=false 면 Toss SDK 호출 → success/fail 페이지로 이동
 *      (성공 후 사용자가 돌아오면 다시 다운로드 버튼 누르면 권한 발급되어 있음)
 */
import { useEffect, useState } from "react";
import { X, Loader2, FileText, ShieldCheck, Hexagon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ESTIMATE_PDF_PRICE_KRW, ESTIMATE_PDF_PRODUCT_CODE } from "@/types/credits";
import { isNativeApp } from "@/lib/mobile/platform";
import { TokenPurchaseDrawer } from "@/components/billing/TokenPurchaseDrawer";

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (
        method: string,
        options: {
          amount: number;
          orderId: string;
          orderName: string;
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
          customerName?: string;
        },
      ) => Promise<void>;
    };
  }
}

function loadTossSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.TossPayments) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Toss SDK 로드 실패"));
    document.head.appendChild(script);
  });
}

interface Props {
  open: boolean;
  estimateId?: string | null;
  consumerProjectId?: string | null;
  onClose: () => void;
  onPaid: (input: { entitlementId: string }) => void;
}

export default function EstimatePdfPurchaseModal({
  open,
  estimateId,
  consumerProjectId,
  onClose,
  onPaid,
}: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 네이티브 앱 — 토큰 우선 발급 경로 (피드백 2026-07-02 #6: 보유 토큰 차감, 부족 시 인앱결제 충전)
  const [native, setNative] = useState(false);
  const [pdfTokenCost, setPdfTokenCost] = useState<number | null>(null);
  const [insufficient, setInsufficient] = useState<{ needed: number; balance: number } | null>(
    null,
  );
  const [chargeOpen, setChargeOpen] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  useEffect(() => {
    if (!open || !native) return;
    let cancelled = false;
    fetch("/api/billing/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { pricing?: { pdfTokenCost?: number | null } }) => {
        if (!cancelled) setPdfTokenCost(d.pricing?.pdfTokenCost ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, native]);

  const handleIssueWithTokens = async () => {
    setError(null);
    setInsufficient(null);
    if (!user) {
      setError("로그인 후 발급 가능합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/issue-pdf-with-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId, consumerProjectId }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setInsufficient({ needed: data.tokensNeeded ?? 0, balance: data.balance ?? 0 });
        return;
      }
      if (!res.ok || !data.entitlementId) {
        setError(data.hint || data.error || "발급 요청 실패");
        return;
      }
      onPaid({ entitlementId: data.entitlementId });
    } catch {
      setError("발급 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const handlePurchase = async () => {
    setError(null);
    if (!user) {
      setError("로그인 후 결제 가능합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: ESTIMATE_PDF_PRODUCT_CODE,
          estimateId,
          consumerProjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.hint || data.error || "결제 요청 실패");
        return;
      }
      if (data.mockMode && data.entitlementId) {
        onPaid({ entitlementId: data.entitlementId });
        return;
      }
      await loadTossSDK();
      const tossPayments = window.TossPayments!(data.clientKey);
      await tossPayments.requestPayment("카드", {
        amount: data.amount,
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: data.successUrl,
        failUrl: data.failUrl,
        customerEmail: user.email || undefined,
        customerName: user.user_metadata?.full_name || user.email?.split("@")[0],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg && !msg.includes("취소") && !msg.includes("cancel")) {
        setError("결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-gray-900">견적서 PDF 다운로드</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
            <p className="text-xs font-bold text-primary-900">선택한 견적서</p>
            <p className="mt-1 text-[0.75rem] text-primary-900/60">
              {estimateId
                ? `견적 ID ${estimateId.slice(0, 8)}…`
                : consumerProjectId
                  ? `프로젝트 ${consumerProjectId.slice(0, 8)}…`
                  : "현재 견적서"}
            </p>
            {native ? (
              <div className="mt-3 flex items-baseline gap-1.5">
                <Hexagon className="h-5 w-5 self-center fill-amber-400 text-amber-500" />
                <span className="text-2xl font-extrabold text-primary-900">
                  {pdfTokenCost ?? "—"}
                </span>
                <span className="text-sm font-semibold text-primary-900/70">토큰</span>
                <span className="ml-2 text-[0.65rem] font-semibold text-primary-700 bg-white px-1.5 py-0.5 rounded">
                  보유 토큰에서 차감
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-primary-900">
                  {ESTIMATE_PDF_PRICE_KRW.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-primary-900/70">원</span>
                <span className="ml-2 text-[0.65rem] font-semibold text-primary-700 bg-white px-1.5 py-0.5 rounded">
                  부가세 포함
                </span>
              </div>
            )}
            <ul className="mt-3 space-y-1 text-[0.75rem] text-primary-900/70">
              <li>· 갑지 + 총괄표 + 공종별 내역서 + 자재집계표 포함</li>
              <li>· A4 가로 7페이지 PDF</li>
              <li>· 1회 다운로드 권한 (재발급 가능)</li>
            </ul>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-[0.7rem]">
              {native
                ? "보유 토큰으로 즉시 발급 — 토큰이 부족하면 인앱결제로 충전할 수 있어요"
                : "토스페이먼츠 안전 결제 (PG 입점 심사 통과 후 정식 운영)"}
            </p>
          </div>

          {insufficient && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-xs font-bold text-amber-900">
                토큰이 부족합니다 — 필요 {insufficient.needed}토큰 / 보유 {insufficient.balance}토큰
              </p>
              <button
                onClick={() => setChargeOpen(true)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
              >
                <Hexagon className="h-3.5 w-3.5 fill-white/30" />
                토큰 충전하기
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
          )}

          <button
            onClick={native ? handleIssueWithTokens : handlePurchase}
            disabled={submitting || !user}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {native ? "발급 진행 중…" : "결제 진행 중…"}
              </>
            ) : native ? (
              <>{pdfTokenCost ? `${pdfTokenCost}토큰으로 발급하고 다운로드` : "토큰으로 발급하고 다운로드"}</>
            ) : (
              <>{ESTIMATE_PDF_PRICE_KRW.toLocaleString()}원 결제하고 다운로드</>
            )}
          </button>
          <button onClick={onClose} className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700">
            취소
          </button>
        </div>
      </div>

      {/* 토큰 부족 시 충전 드로어 (네이티브에선 내부에서 IAP 사용) — 충전 완료 후 자동 재발급 */}
      <TokenPurchaseDrawer
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        reason="manual_topup"
        requiredTokens={insufficient?.needed}
        currentTokens={insufficient?.balance}
        onProvisioned={() => {
          setChargeOpen(false);
          setInsufficient(null);
          void handleIssueWithTokens();
        }}
      />
    </div>
  );
}
