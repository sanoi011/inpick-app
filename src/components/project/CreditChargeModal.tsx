"use client";

import { useState } from "react";
import { X, Coins, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import {
  CREDIT_PACKAGES,
  CREDITS_PER_GENERATION,
  FREE_GENERATION_LIMIT,
} from "@/types/credits";

interface CreditChargeModalProps {
  open: boolean;
  onClose: () => void;
}

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
        }
      ) => Promise<void>;
    };
  }
}

function loadTossSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) {
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

export default function CreditChargeModal({
  open,
  onClose,
}: CreditChargeModalProps) {
  const { user } = useAuth();
  const { credits, reload } = useCredits();
  const [charging, setCharging] = useState<string | null>(null);
  const [mockResult, setMockResult] = useState<{
    credits: number;
    newBalance: number;
  } | null>(null);

  if (!open) return null;

  const handleCharge = async (packageId: string) => {
    if (!user || charging) return;
    setCharging(packageId);
    setMockResult(null);

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, userId: user.id }),
      });
      const data = await res.json();

      if (data.mockMode) {
        // Mock 모드: 바로 충전 완료
        setMockResult({
          credits: data.credits,
          newBalance: data.newBalance,
        });
        await reload();
      } else {
        // 실제 Toss Payments
        await loadTossSDK();
        const tossPayments = window.TossPayments!(data.clientKey);
        await tossPayments.requestPayment("카드", {
          amount: data.amount,
          orderId: data.orderId,
          orderName: data.orderName,
          successUrl: data.successUrl,
          failUrl: data.failUrl,
          customerEmail: user.email || undefined,
          customerName:
            user.user_metadata?.full_name || user.email?.split("@")[0],
        });
      }
    } catch {
      // 사용자 취소 또는 에러
    } finally {
      setCharging(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">크레딧 충전</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Mock 결과 */}
        {mockResult && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <Coins className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-green-800">
              {mockResult.credits} 크레딧 충전 완료!
            </p>
            <p className="text-xs text-green-600 mt-1">
              현재 잔액: {mockResult.newBalance} 크레딧
            </p>
            <p className="text-[10px] text-gray-400 mt-2">
              테스트 모드 (Toss 키 미설정)
            </p>
          </div>
        )}

        {/* 현재 잔액 */}
        {credits && !mockResult && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center">
            <p className="text-xs text-gray-500">현재 잔액</p>
            <p className="text-2xl font-bold text-gray-900">
              {credits.balance} 크레딧
            </p>
            {credits.freeGenerationsUsed < FREE_GENERATION_LIMIT && (
              <p className="text-xs text-green-600 mt-1">
                무료 {FREE_GENERATION_LIMIT - credits.freeGenerationsUsed}회 남음
              </p>
            )}
          </div>
        )}

        {/* 비로그인 */}
        {!user && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-sm text-amber-700">
              로그인 후 크레딧을 충전할 수 있습니다
            </p>
            <a
              href="/auth"
              className="inline-block mt-2 px-4 py-1.5 bg-amber-600 text-white text-sm rounded-lg"
            >
              로그인하기
            </a>
          </div>
        )}

        {/* 패키지 목록 */}
        {!mockResult && (
          <div className="space-y-2">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleCharge(pkg.id)}
                disabled={!user || !!charging}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {pkg.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    이미지 {pkg.credits / CREDITS_PER_GENERATION}회 생성
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  {charging === pkg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-bold text-blue-600">
                          {pkg.price.toLocaleString()}원
                        </p>
                        {pkg.discount && (
                          <p className="text-[10px] text-green-600">
                            {pkg.discount}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 닫기 / 완료 버튼 */}
        {mockResult && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            확인
          </button>
        )}

        {!mockResult && (
          <p className="text-[10px] text-gray-400 text-center mt-3">
            {process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
              ? "토스페이먼츠로 안전하게 결제됩니다"
              : "결제 시스템 테스트 모드 (키 미설정 시 바로 충전)"}
          </p>
        )}
      </div>
    </div>
  );
}
