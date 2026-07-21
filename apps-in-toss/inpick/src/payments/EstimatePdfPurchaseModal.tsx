import { useState } from "react";
import { FileText, Loader2, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../inpick-source/src/hooks/useAuth";
import {
  ESTIMATE_PDF_PRICE_KRW,
  ESTIMATE_PDF_PRODUCT_CODE,
} from "../../inpick-source/src/types/credits";
import { purchaseWithAppsInTossPay } from "./apps-in-toss-pay";

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
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const handlePurchase = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("로그인 후 결제 가능합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await purchaseWithAppsInTossPay({
        productCode: ESTIMATE_PDF_PRODUCT_CODE,
        estimateId,
        consumerProjectId,
        returnPath: "/workflow/estimate",
      });
      if (result.testMode) {
        setSuccess(result.message || "샌드박스 결제 인증 테스트가 완료됐습니다.");
        return;
      }
      if (result.ok && result.provisioned && result.entitlementId) {
        onPaid({ entitlementId: result.entitlementId });
        return;
      }
      if (!result.cancelled) {
        setError(result.error || "앱인토스 페이 결제를 완료하지 못했습니다.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (!/cancel|close|취소|닫/i.test(message)) {
        setError(message || "결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-bold text-gray-900">계약견적서 패키지</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-5 py-5">
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
            <p className="text-xs font-bold text-primary-900">공사 계약·견적 서류 세트</p>
            <p className="mt-1 text-[0.75rem] text-primary-900/60">
              {estimateId
                ? `견적 ID ${estimateId.slice(0, 8)}…`
                : consumerProjectId
                  ? `프로젝트 ${consumerProjectId.slice(0, 8)}…`
                  : "현재 견적서"}
            </p>
            <div className="mt-3 flex items-baseline gap-1">
              <strong className="text-2xl text-primary-900">
                {ESTIMATE_PDF_PRICE_KRW.toLocaleString()}
              </strong>
              <span className="text-sm font-semibold text-primary-900/70">원</span>
              <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary-700">
                부가세 포함
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-[0.75rem] text-primary-900/70">
              <li>· 공정위 제10079호 표준계약서 공식 원본 갑지·을지</li>
              <li>· 견적 갑지 + 총괄표 + 공종별 세부내역 + 자재집계표</li>
              <li>· AI 디자인 이미지 + 특기사항 기입 공간 + 서명란</li>
              <li>· 1회 다운로드 권한 (재발급 가능)</li>
            </ul>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <p className="text-[0.7rem]">
              토스 앱 안에서 앱인토스 페이로만 안전하게 결제됩니다.
            </p>
          </div>
          {success ? (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            onClick={handlePurchase}
            disabled={submitting || !user}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-4 py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 결제 진행 중…
              </>
            ) : (
              <>{ESTIMATE_PDF_PRICE_KRW.toLocaleString()}원 토스페이 결제</>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            취소
          </button>
        </div>
      </section>
    </div>
  );
}
