"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [status, setStatus] = useState<"confirming" | "success" | "error">("confirming");
  const [credits, setCredits] = useState(0);
  const [newBalance, setNewBalance] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const creditAmount = searchParams.get("credits");

    if (!paymentKey || !orderId || !amount || !user) {
      setStatus("error");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
        credits: Number(creditAmount),
        userId: user.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setCredits(data.credits);
          setNewBalance(data.newBalance);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "결제 확인 실패");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("결제 확인 중 오류가 발생했습니다.");
      });
  }, [searchParams, user]);

  if (status === "confirming") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">결제를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">결제 확인 실패</h2>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">충전 완료!</h2>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-amber-500" />
          <span className="text-2xl font-bold text-gray-900">{credits} 크레딧</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          현재 잔액: <strong>{newBalance} 크레딧</strong>
        </p>
        <button
          onClick={() => router.back()}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
