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
import { useState } from "react";
import { X, Loader2, FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ESTIMATE_PDF_PRICE_KRW, ESTIMATE_PDF_PRODUCT_CODE } from "@/types/credits";

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
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-primary-900">
                {ESTIMATE_PDF_PRICE_KRW.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-primary-900/70">원</span>
              <span className="ml-2 text-[0.65rem] font-semibold text-primary-700 bg-white px-1.5 py-0.5 rounded">
                부가세 포함
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-[0.75rem] text-primary-900/70">
              <li>· 갑지 + 총괄표 + 공종별 내역서 + 자재집계표 포함</li>
              <li>· A4 가로 7페이지 PDF</li>
              <li>· 1회 다운로드 권한 (재발급 가능)</li>
            </ul>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-[0.7rem]">토스페이먼츠 안전 결제 (PG 입점 심사 통과 후 정식 운영)</p>
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
          )}

          <button
            onClick={handlePurchase}
            disabled={submitting || !user}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 결제 진행 중…
              </>
            ) : (
              <>{ESTIMATE_PDF_PRICE_KRW.toLocaleString()}원 결제하고 다운로드</>
            )}
          </button>
          <button onClick={onClose} className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
