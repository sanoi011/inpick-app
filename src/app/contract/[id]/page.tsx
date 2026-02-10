"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, FileText, CheckCircle2, Pen, Building2, Phone,
  Mail, Calendar, CreditCard, AlertCircle, Shield, Clock,
} from "lucide-react";
import type { Contract } from "@/types/contract";
import { mapDbContract, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/types/contract";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

function PaymentTimeline({ contract }: { contract: Contract }) {
  const payments = contract.progressPayments;
  const paidCount = payments.filter((p) => p.status === "PAID").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> 결제 일정
        </h3>
        <span className="text-xs text-gray-500">{paidCount}/{payments.length} 완료</span>
      </div>

      {/* Progress bar */}
      <div className="flex rounded-full overflow-hidden h-2 mb-6 bg-gray-100">
        {payments.map((p, i) => (
          <div key={i} className={`transition-all ${
            p.status === "PAID" ? "bg-green-500" : "bg-gray-200"
          }`} style={{ width: `${p.percentage}%` }} />
        ))}
      </div>

      <div className="space-y-3">
        {payments.map((payment, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
            payment.status === "PAID" ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                payment.status === "PAID" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {payment.status === "PAID" ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{payment.phase}</p>
                <p className="text-xs text-gray-500">
                  {payment.percentage}% | {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString("ko-KR") : "일정 미정"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{fmt(payment.amount)}원</p>
              {payment.paidAt && (
                <p className="text-xs text-green-600">{new Date(payment.paidAt).toLocaleDateString("ko-KR")} 지급</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignatureSection({ contract, onSign }: { contract: Contract; onSign: (type: 'consumer' | 'contractor') => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-5">
        <Pen className="w-4 h-4" /> 전자 서명
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Consumer Signature */}
        <div className={`border-2 rounded-xl p-4 text-center transition-all ${
          contract.consumerSignature ? "border-green-300 bg-green-50" : "border-dashed border-gray-300"
        }`}>
          <p className="text-xs text-gray-500 mb-2">소비자 서명</p>
          {contract.consumerSignature ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-xs text-green-600">서명 완료</p>
              <p className="text-xs text-gray-400">{new Date(contract.consumerSignature).toLocaleDateString("ko-KR")}</p>
            </div>
          ) : (
            <button onClick={() => onSign("consumer")}
              className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              서명하기
            </button>
          )}
        </div>

        {/* Contractor Signature */}
        <div className={`border-2 rounded-xl p-4 text-center transition-all ${
          contract.contractorSignature ? "border-green-300 bg-green-50" : "border-dashed border-gray-300"
        }`}>
          <p className="text-xs text-gray-500 mb-2">시공사 서명</p>
          {contract.contractorSignature ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-xs text-green-600">서명 완료</p>
              <p className="text-xs text-gray-400">{new Date(contract.contractorSignature).toLocaleDateString("ko-KR")}</p>
            </div>
          ) : (
            <button onClick={() => onSign("contractor")}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              서명하기
            </button>
          )}
        </div>
      </div>

      {contract.signedAt && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">
            계약 체결 완료 ({new Date(contract.signedAt).toLocaleDateString("ko-KR")})
          </p>
        </div>
      )}
    </div>
  );
}

export default function ContractDetailPage() {
  const params = useParams();
  const bidId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // 먼저 기존 계약 조회
        const res = await fetch(`/api/contracts?estimateId=all`);
        const data = await res.json();
        const existing = (data.contracts || []).find(
          (c: Record<string, unknown>) => c.bid_id === bidId
        );

        if (existing) {
          setContract(mapDbContract(existing));
        } else {
          // 계약 없으면 자동 생성
          setCreating(true);
          const createRes = await fetch("/api/contracts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bidId }),
          });
          const createData = await createRes.json();
          if (createData.contract) {
            setContract(mapDbContract(createData.contract));
          } else {
            setError("계약서를 생성할 수 없습니다.");
          }
          setCreating(false);
        }
      } catch {
        setError("계약 정보를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bidId]);

  const handleSign = async (type: 'consumer' | 'contractor') => {
    if (!contract) return;
    const res = await fetch("/api/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contract.id, sign: type }),
    });
    const data = await res.json();
    if (data.contract) {
      setContract(mapDbContract(data.contract));
    }
  };

  if (loading || creating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">{creating ? "계약서 생성중..." : "로딩중..."}</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <Link href="/contractor/bids" className="text-sm text-blue-600 hover:underline">목록으로</Link>
      </div>
    );
  }

  const contractor = (contract as unknown as Record<string, unknown>).specialty_contractors as Record<string, string> | undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/contractor/bids" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">계약서</span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CONTRACT_STATUS_COLORS[contract.status]}`}>
            {CONTRACT_STATUS_LABELS[contract.status]}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Contract Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">인테리어 공사 계약서</h1>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">공사 정보</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">프로젝트</span>
                  <span className="text-sm font-semibold text-gray-900">{contract.projectName}</span>
                </div>
                {contract.address && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">주소</span>
                    <span className="text-sm text-gray-900">{contract.address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">계약 금액</span>
                  <span className="text-sm font-bold text-blue-600">{fmt(contract.totalAmount)}원</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">일정</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> 착공일</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {contract.startDate ? new Date(contract.startDate).toLocaleDateString("ko-KR") : "미정"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 완공 예정</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {contract.expectedEndDate ? new Date(contract.expectedEndDate).toLocaleDateString("ko-KR") : "미정"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contractor Info */}
        {contractor && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">시공사 정보</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{contractor.company_name}</p>
                <p className="text-xs text-gray-500">{contractor.contact_name}</p>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                {contractor.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contractor.phone}</span>
                )}
                {contractor.email && (
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contractor.email}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Timeline */}
        <PaymentTimeline contract={contract} />

        {/* Signature Section */}
        {(contract.status === "PENDING_SIGNATURE" || contract.status === "DRAFT") && (
          <SignatureSection contract={contract} onSign={handleSign} />
        )}

        {contract.status === "SIGNED" && (
          <div className="bg-green-600 text-white rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-80" />
            <h3 className="text-lg font-bold mb-1">계약이 체결되었습니다</h3>
            <p className="text-sm text-green-100">
              {contract.signedAt && `${new Date(contract.signedAt).toLocaleDateString("ko-KR")} 서명 완료`}
            </p>
          </div>
        )}

        {/* AI Consult Reference */}
        {contract.consultLogSnapshot.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">AI 상담 기록 (계약 근거)</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {contract.consultLogSnapshot.slice(-10).map((msg, i) => (
                <div key={i} className={`p-2.5 rounded-lg text-sm ${
                  msg.role === "user" ? "bg-blue-50 text-blue-800 ml-8" : "bg-gray-50 text-gray-700 mr-8"
                }`}>
                  <span className="text-xs text-gray-400 block mb-0.5">{msg.role === "user" ? "고객" : "AI 상담"}</span>
                  <p className="line-clamp-3">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
