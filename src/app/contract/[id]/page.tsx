"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Loader2, FileText, CheckCircle2, Pen, Building2, Phone,
  Mail, Calendar, CreditCard, AlertCircle, Shield, MessageCircle,
  ChevronDown, ChevronUp, Download, FileImage, ClipboardList, Scale,
  Edit3, Image as ImageIcon, Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Contract } from "@/types/contract";
import { mapDbContract, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/types/contract";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { ConstructionSchedule } from "@/types/construction-schedule";
import { ScheduleOverview } from "@/components/schedule/ScheduleOverview";
import { generateContractPdf } from "@/lib/pdf/contract-pdf-generator";
import { generateConstructionDrawingPdf } from "@/lib/pdf/construction-drawing-pdf";
import { toast } from "@/components/ui/Toast";
import SignaturePad from "@/components/contract/SignaturePad";
import dynamic from "next/dynamic";

const DrawingGenerationProgress = dynamic(
  () => import("@/components/contract/DrawingGenerationProgress"),
  { ssr: false }
);
const DrawingViewer = dynamic(
  () => import("@/components/contract/DrawingViewer"),
  { ssr: false }
);

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

// ─── 1부: 공정위 실내건축공사 표준계약서 갑지 + 전문 ───

function ContractPart1({ contract, contractor }: {
  contract: Contract;
  contractor?: Record<string, string>;
}) {
  const [showFullText, setShowFullText] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Scale className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">제1부: 공정위 실내건축공사 표준계약서</h3>
      </div>

      <div className="p-6">
        {/* 갑지 (표지) */}
        <div className="border-2 border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-center text-xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-gray-800">
            실내건축공사 표준계약서
          </h2>
          <p className="text-center text-xs text-gray-500 mb-6">
            공정거래위원회 표준약관 제10096호 준용
          </p>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-y-3">
              <span className="font-bold text-gray-700">1. 공사명</span>
              <span className="text-gray-900 border-b border-gray-300 pb-1">
                {contract.projectName || "인테리어 공사"}
              </span>

              <span className="font-bold text-gray-700">2. 공사장소</span>
              <span className="text-gray-900 border-b border-gray-300 pb-1">
                {contract.address || "미정"}
              </span>

              <span className="font-bold text-gray-700">3. 공사기간</span>
              <span className="text-gray-900 border-b border-gray-300 pb-1">
                {contract.startDate ? new Date(contract.startDate).toLocaleDateString("ko-KR") : "미정"}
                {" ~ "}
                {contract.expectedEndDate ? new Date(contract.expectedEndDate).toLocaleDateString("ko-KR") : "미정"}
              </span>

              <span className="font-bold text-gray-700">4. 공사금액</span>
              <span className="text-gray-900 border-b border-gray-300 pb-1 font-bold text-blue-700">
                금 {fmt(contract.totalAmount)}원 (부가세 포함)
              </span>

              <span className="font-bold text-gray-700">5. 계약일</span>
              <span className="text-gray-900 border-b border-gray-300 pb-1">
                {contract.signedAt
                  ? new Date(contract.signedAt).toLocaleDateString("ko-KR")
                  : new Date().toLocaleDateString("ko-KR")}
              </span>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold text-gray-500 mb-2">갑 (소비자)</h4>
                <div className="space-y-1 text-xs text-gray-700">
                  <p>성명: ___________________</p>
                  <p>주소: {contract.address || "___________________"}</p>
                  <p>연락처: ___________________</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-500 mb-2">을 (시공사)</h4>
                <div className="space-y-1 text-xs text-gray-700">
                  <p>상호: {contractor?.company_name || "___________________"}</p>
                  <p>대표: {contractor?.contact_name || "___________________"}</p>
                  <p>연락처: {contractor?.phone || "___________________"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 전문 토글 */}
        <button
          onClick={() => setShowFullText(!showFullText)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="text-xs font-medium text-gray-600">
            계약 일반조건 (전문) 보기
          </span>
          {showFullText ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showFullText && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed space-y-3 max-h-96 overflow-y-auto">
            <h4 className="font-bold text-gray-800">제1조 (총칙)</h4>
            <p>본 계약은 갑(소비자)이 을(시공사)에게 실내건축공사를 도급함에 있어 필요한 사항을 정함을 목적으로 한다.</p>

            <h4 className="font-bold text-gray-800">제2조 (공사 범위)</h4>
            <p>을은 본 계약서 및 첨부 설계도서(도면, 시방서, 내역서 등)에 따라 공사를 성실히 수행하여야 한다.</p>

            <h4 className="font-bold text-gray-800">제3조 (공사기간)</h4>
            <p>① 을은 약정한 기간 내에 공사를 완료하여야 한다. ② 천재지변, 갑의 사정 등 부득이한 사유로 공사기간의 변경이 필요한 경우, 갑·을 합의 하에 변경할 수 있다.</p>

            <h4 className="font-bold text-gray-800">제4조 (공사대금의 지급)</h4>
            <p>① 갑은 공사대금을 공사 진행에 따라 분할 지급한다. ② 선급금은 계약 체결 시, 중도금은 공정률 50% 시점, 잔금은 준공 검사 후 지급한다.</p>

            <h4 className="font-bold text-gray-800">제5조 (설계 변경)</h4>
            <p>① 갑이 설계 변경을 요구할 경우, 을과 협의하여 추가 비용 및 공기 변경 사항을 서면으로 합의한다. ② 을은 갑의 서면 승인 없이 설계를 임의로 변경할 수 없다.</p>

            <h4 className="font-bold text-gray-800">제6조 (자재)</h4>
            <p>① 을은 내역서에 명시된 자재를 사용하여야 한다. ② 동등 이상의 자재로 대체할 경우 갑의 사전 승인을 받아야 한다.</p>

            <h4 className="font-bold text-gray-800">제7조 (하자보수)</h4>
            <p>① 을은 공사 완료 후 1년간 하자보수 책임을 진다. ② 방수공사는 3년, 구조체는 5년의 하자보수 기간을 적용한다. ③ 갑의 귀책 사유로 발생한 하자는 제외한다.</p>

            <h4 className="font-bold text-gray-800">제8조 (준공 검사)</h4>
            <p>을은 공사 완료 시 갑에게 통지하고, 갑은 통지 받은 날로부터 7일 이내에 준공 검사를 실시한다.</p>

            <h4 className="font-bold text-gray-800">제9조 (지체 배상)</h4>
            <p>을의 귀책 사유로 공사가 지연될 경우, 지체일수 1일당 공사대금의 1/1000에 해당하는 지체배상금을 갑에게 지급한다.</p>

            <h4 className="font-bold text-gray-800">제10조 (계약의 해제·해지)</h4>
            <p>① 갑·을 일방이 계약 조건을 위반한 경우 상대방은 서면 최고 후 계약을 해제·해지할 수 있다. ② 해제·해지 시 기성 부분에 대한 정산은 갑·을 합의에 의한다.</p>

            <h4 className="font-bold text-gray-800">제11조 (분쟁해결)</h4>
            <p>본 계약에 관한 분쟁은 갑·을 합의에 의해 해결하되, 합의가 이루어지지 않을 경우 관할 법원의 판결에 따른다.</p>

            <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
              본 계약서는 공정거래위원회 실내건축공사 표준계약서(표준약관 제10096호)를 준용하여 작성되었습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 2부: 소비자 특기사항 ───

function ContractPart2({ contract, onUpdateNotes }: {
  contract: Contract;
  onUpdateNotes: (notes: string) => void;
}) {
  const isSigned = contract.status === "SIGNED" || contract.status === "IN_PROGRESS";
  const [notes, setNotes] = useState("");
  const [checkItems] = useState<string[]>([
    "시공 중 분진·소음 최소화 (양생 철저)",
    "기존 가구/가전 보양 처리",
    "시공 후 준공 청소 포함",
    "자재 반입 시 엘리베이터 보양",
  ]);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Edit3 className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-bold text-gray-900">제2부: 소비자 특기사항</h3>
      </div>

      <div className="p-6 space-y-5">
        {/* 필수 체크 항목 */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-3">공사 시 반드시 지켜주세요</h4>
          <div className="space-y-2">
            {checkItems.map((item, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checkedItems.has(idx)
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                } ${isSigned ? "pointer-events-none opacity-70" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checkedItems.has(idx)}
                  onChange={() => toggleCheck(idx)}
                  disabled={isSigned}
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-700">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 자유 특기사항 */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-2">추가 특기사항 (자유 기재)</h4>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              onUpdateNotes(e.target.value);
            }}
            disabled={isSigned}
            placeholder="시공 시 특별히 요청할 사항을 입력하세요... (예: 주말 시공 불가, 반려동물 주의, 특정 자재 지정 등)"
            className="w-full h-32 px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 3부: 도면 + 이미지컷 + 세부내역 ───

function ContractPart3({ contract }: { contract: Contract }) {
  const [showDetails, setShowDetails] = useState(false);
  const estimateData = (contract as unknown as Record<string, unknown>).estimate_data as Record<string, unknown> | undefined;
  const floorPlanUrl = (contract as unknown as Record<string, unknown>).floor_plan_url as string | undefined;
  const designImages = (contract as unknown as Record<string, unknown>).design_images as string[] | undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-green-600" />
        <h3 className="text-sm font-bold text-gray-900">제3부: 도면·디자인·세부내역</h3>
      </div>

      <div className="p-6 space-y-5">
        {/* 도면 */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <FileImage className="w-3.5 h-3.5" /> 2D 평면도
          </h4>
          {floorPlanUrl ? (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={floorPlanUrl} alt="평면도" className="w-full h-auto max-h-[400px] object-contain bg-gray-50" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <FileImage className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">도면이 첨부되지 않았습니다</p>
            </div>
          )}
        </div>

        {/* AI 디자인 이미지 */}
        {designImages && designImages.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> AI 디자인 이미지컷
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {designImages.map((url, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={url}
                  alt={`디자인 ${idx + 1}`}
                  className="h-32 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                />
              ))}
            </div>
          </div>
        )}

        {/* 세부내역서 */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              물량산출 세부내역서
            </span>
            {showDetails ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showDetails && (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
              {estimateData ? (
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-500 mb-1">직접 재료비</p>
                      <p className="text-sm font-bold text-blue-800">
                        {fmt(Number((estimateData as Record<string, unknown>).directMaterialCost) || 0)}원
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-indigo-500 mb-1">직접 노무비</p>
                      <p className="text-sm font-bold text-indigo-800">
                        {fmt(Number((estimateData as Record<string, unknown>).directLaborCost) || 0)}원
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">간접비 (6%)</span>
                      <span className="text-gray-700">{fmt(Number((estimateData as Record<string, unknown>).overheadAmount) || 0)}원</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">이윤 (5%)</span>
                      <span className="text-gray-700">{fmt(Number((estimateData as Record<string, unknown>).profitAmount) || 0)}원</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">부가세 (10%)</span>
                      <span className="text-gray-700">{fmt(Number((estimateData as Record<string, unknown>).vatAmount) || 0)}원</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                      <span className="text-gray-900">총 합계</span>
                      <span className="text-blue-600">{fmt(Number((estimateData as Record<string, unknown>).grandTotal) || contract.totalAmount)}원</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400">세부내역이 첨부되지 않았습니다</p>
                  <p className="text-xs text-gray-300 mt-1">계약 금액: {fmt(contract.totalAmount)}원</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 4부: 전자서명 ───

function ContractPart4({ contract, onSign, contractor }: {
  contract: Contract;
  onSign: (type: 'consumer' | 'contractor', signatureImage?: string) => void;
  contractor?: Record<string, string>;
}) {
  const [signingType, setSigningType] = useState<'consumer' | 'contractor' | null>(null);
  // 서명 이미지 (로컬 캐시)
  const [consumerSigImage, setConsumerSigImage] = useState<string | null>(
    (contract as unknown as Record<string, unknown>).consumer_signature_image as string | null
  );
  const [contractorSigImage, setContractorSigImage] = useState<string | null>(
    (contract as unknown as Record<string, unknown>).contractor_signature_image as string | null
  );

  const handleSignatureComplete = (dataUrl: string) => {
    if (signingType === "consumer") {
      setConsumerSigImage(dataUrl);
    } else {
      setContractorSigImage(dataUrl);
    }
    onSign(signingType!, dataUrl);
    setSigningType(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Pen className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-gray-900">제4부: 전자서명</h3>
      </div>

      {/* 서명 패드 모달 */}
      {signingType && (
        <SignaturePad
          onComplete={handleSignatureComplete}
          onCancel={() => setSigningType(null)}
          width={Math.min(400, typeof window !== "undefined" ? window.innerWidth - 48 : 400)}
          height={200}
        />
      )}

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 소비자 서명 */}
          <div className={`border-2 rounded-xl p-5 text-center transition-all ${
            contract.consumerSignature ? "border-green-300 bg-green-50" : "border-dashed border-gray-300"
          }`}>
            <p className="text-xs font-bold text-gray-500 mb-1">갑 (소비자)</p>
            <p className="text-xs text-gray-400 mb-3">발주자 서명</p>
            {contract.consumerSignature ? (
              <div className="flex flex-col items-center gap-2">
                {consumerSigImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={consumerSigImage} alt="소비자 서명" className="h-16 object-contain border border-gray-200 rounded-lg bg-white p-1" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                )}
                <p className="text-xs font-medium text-green-700">서명 완료</p>
                <p className="text-xs text-gray-400">
                  {new Date(contract.consumerSignature).toLocaleDateString("ko-KR")} {new Date(contract.consumerSignature).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setSigningType("consumer")}
                className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Pen className="w-4 h-4" />
                소비자 서명하기
              </button>
            )}
          </div>

          {/* 사업자 서명 */}
          <div className={`border-2 rounded-xl p-5 text-center transition-all ${
            contract.contractorSignature ? "border-green-300 bg-green-50" : "border-dashed border-gray-300"
          }`}>
            <p className="text-xs font-bold text-gray-500 mb-1">을 (시공사)</p>
            <p className="text-xs text-gray-400 mb-3">수급인 서명</p>
            {contract.contractorSignature ? (
              <div className="flex flex-col items-center gap-2">
                {contractorSigImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contractorSigImage} alt="시공사 서명" className="h-16 object-contain border border-gray-200 rounded-lg bg-white p-1" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                )}
                <p className="text-xs font-medium text-green-700">서명 완료</p>
                <p className="text-xs text-gray-400">
                  {new Date(contract.contractorSignature).toLocaleDateString("ko-KR")} {new Date(contract.contractorSignature).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setSigningType("contractor")}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Pen className="w-4 h-4" />
                시공사 서명하기
              </button>
            )}
          </div>
        </div>

        {contract.signedAt && (
          <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-bold text-green-700">계약 체결 완료</p>
                <p className="text-xs text-green-600">
                  {new Date(contract.signedAt).toLocaleDateString("ko-KR")} 양측 서명 완료
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                await generateContractPdf({
                  id: contract.id,
                  projectName: contract.projectName,
                  address: contract.address || "",
                  totalAmount: contract.totalAmount,
                  depositAmount: contract.depositAmount,
                  finalPayment: contract.finalPayment,
                  progressPayments: contract.progressPayments.map((p) => ({
                    label: p.phase, amount: p.amount, dueDate: p.dueDate || "", status: p.status,
                  })),
                  startDate: contract.startDate || "",
                  expectedEndDate: contract.expectedEndDate || "",
                  consumerSignature: contract.consumerSignature || undefined,
                  contractorSignature: contract.contractorSignature || undefined,
                  signedAt: contract.signedAt || undefined,
                  contractorName: contractor?.company_name || contractor?.contact_name || "",
                  consumerName: "",
                });
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              계약서 다운로드
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 결제 일정 ───

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

// ─── 5부: 리뷰 작성 ───

function ReviewSection({ contract, userId }: { contract: Contract; userId?: string }) {
  const contractorId = (contract as unknown as Record<string, unknown>).contractor_id as string;
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReview, setExistingReview] = useState<Record<string, unknown> | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!contractorId) { setCheckingExisting(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/reviews?contractorId=${contractorId}&contractId=${contract.id}`);
        const data = await res.json();
        if (data.review) setExistingReview(data.review);
      } catch { toast({ type: "error", title: "오류", message: "리뷰를 불러올 수 없습니다" }); }
      setCheckingExisting(false);
    })();
  }, [contractorId, contract.id]);

  const handleSubmit = async () => {
    if (rating === 0 || !content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId,
          contractId: contract.id,
          rating,
          title: title.trim() || undefined,
          content: content.trim(),
          reviewerId: userId || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch { toast({ type: "error", title: "오류", message: "리뷰 등록에 실패했습니다" }); }
    setSubmitting(false);
  };

  if (checkingExisting) return null;

  // 이미 리뷰를 작성한 경우
  if (existingReview || submitted) {
    const r = existingReview;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <h3 className="text-sm font-bold text-gray-900">내가 작성한 리뷰</h3>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`w-4 h-4 ${i <= ((r?.rating as number) || rating) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
          ))}
          <span className="text-sm font-semibold text-gray-700 ml-1">{(r?.rating as number) || rating}</span>
        </div>
        {(r?.title || title) && <p className="text-sm font-semibold text-gray-800 mb-1">{(r?.title as string) || title}</p>}
        <p className="text-sm text-gray-600">{(r?.content as string) || content}</p>
        <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> 리뷰가 등록되었습니다
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-bold text-gray-900">시공 리뷰 작성</h3>
      </div>

      {/* 별점 */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">시공 만족도를 평가해주세요</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(i)}
              className="p-0.5"
            >
              <Star className={`w-7 h-7 transition-colors ${
                i <= (hoverRating || rating)
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-gray-300"
              }`} />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm font-semibold text-gray-700 ml-2">
              {rating === 5 ? "매우 만족" : rating === 4 ? "만족" : rating === 3 ? "보통" : rating === 2 ? "불만족" : "매우 불만족"}
            </span>
          )}
        </div>
      </div>

      {/* 제목 */}
      <input
        type="text"
        placeholder="리뷰 제목 (선택)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* 내용 */}
      <textarea
        placeholder="시공 후기를 작성해주세요 (최소 10자)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={1000}
        rows={4}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{content.length}/1000</p>
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || content.trim().length < 10 || submitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          리뷰 등록
        </button>
      </div>
    </div>
  );
}

// ─── 메인 컨텐츠 ───

function ContractDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bidId = params.id as string;
  const { user } = useAuth();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ConstructionSchedule | null>(null);
  const [activeSection, setActiveSection] = useState<number>(1);

  // 시공도면 상태
  const [drawingMode, setDrawingMode] = useState<"idle" | "generating" | "viewing">("idle");
  const [drawingResult, setDrawingResult] = useState<{
    drawings: Array<{ drawingType: string; finalUrl?: string; metadata?: Record<string, unknown> }>;
  } | null>(null);

  const backUrl = searchParams.get("from") || (user ? "/contracts" : "/contractor/bids");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/contracts?estimateId=all`);
        const data = await res.json();
        const existing = (data.contracts || []).find(
          (c: Record<string, unknown>) => c.bid_id === bidId
        );

        if (existing) {
          setContract(mapDbContract(existing));
        } else {
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

  useEffect(() => {
    if (!contract?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/schedule?contractId=${contract.id}`);
        const data = await res.json();
        if (data.generated && data.schedule) setSchedule(data.schedule);
      } catch { toast({ type: "error", title: "오류", message: "시공 일정을 불러올 수 없습니다" }); }
    })();
  }, [contract?.id]);

  // 기존 시공도면 확인
  useEffect(() => {
    if (!contract?.id) return;
    if (!["SIGNED", "IN_PROGRESS", "COMPLETED"].includes(contract.status)) return;
    (async () => {
      try {
        const res = await fetch(`/api/project/generate-drawings?contractId=${contract.id}`);
        const data = await res.json();
        if (data.exists && data.drawingSet?.status === "completed" && data.drawings?.length > 0) {
          setDrawingResult({
            drawings: data.drawings.map((d: Record<string, unknown>) => ({
              drawingType: d.drawing_type,
              finalUrl: d.final_url,
              metadata: d.metadata,
            })),
          });
          setDrawingMode("viewing");
        }
      } catch { /* 도면 조회 실패 무시 */ }
    })();
  }, [contract?.id, contract?.status]);

  // URL 해시 네비게이션 (#drawings → 5부)
  useEffect(() => {
    if (!contract) return;
    const hash = window.location.hash;
    if (hash === "#drawings" && ["SIGNED", "IN_PROGRESS", "COMPLETED"].includes(contract.status)) {
      setActiveSection(5);
    } else if (hash === "#signature") {
      setActiveSection(4);
    }
  }, [contract]);

  const handleSign = useCallback(async (type: 'consumer' | 'contractor', signatureImage?: string) => {
    if (!contract) return;
    const payload: Record<string, unknown> = { id: contract.id, sign: type };
    if (signatureImage) {
      const fieldName = type === "consumer" ? "consumer_signature_image" : "contractor_signature_image";
      payload[fieldName] = signatureImage;
    }
    const res = await fetch("/api/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.contract) {
      setContract(mapDbContract(data.contract));
    }
  }, [contract]);

  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdateNotes = useCallback((notes: string) => {
    if (!contract) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/contracts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: contract.id, consumer_notes: notes }),
        });
      } catch { /* silent */ }
    }, 1000);
  }, [contract]);

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
        <Link href={backUrl} className="text-sm text-blue-600 hover:underline">목록으로</Link>
      </div>
    );
  }

  const contractor = (contract as unknown as Record<string, unknown>).specialty_contractors as Record<string, string> | undefined;

  // 채팅 사용자 정보
  const isContractor = !user;
  const chatUserId = isContractor
    ? (typeof window !== "undefined" ? localStorage.getItem("contractor_id") || "" : "")
    : (user?.id || "");
  const chatUserType: "consumer" | "contractor" = isContractor ? "contractor" : "consumer";
  const chatUserName = isContractor
    ? (typeof window !== "undefined" ? localStorage.getItem("contractor_name") || "시공사" : "시공사")
    : (user?.user_metadata?.full_name || user?.email?.split("@")[0] || "고객");
  const chatOtherName = isContractor
    ? "고객"
    : (contractor?.company_name || "시공사");

  const showDrawingSection = ["SIGNED", "IN_PROGRESS", "COMPLETED"].includes(contract.status);

  const sections = [
    { id: 1, label: "계약서", icon: Scale },
    { id: 2, label: "특기사항", icon: Edit3 },
    { id: 3, label: "첨부서류", icon: ClipboardList },
    { id: 4, label: "전자서명", icon: Pen },
    ...(showDrawingSection ? [{ id: 5, label: "시공도면", icon: FileImage }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backUrl} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">계약진행</span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CONTRACT_STATUS_COLORS[contract.status]}`}>
            {CONTRACT_STATUS_LABELS[contract.status]}
          </span>
        </div>
      </header>

      {/* 4부 네비게이션 */}
      <div className="bg-white border-b border-gray-200 sticky top-[57px] z-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {sec.id}부: {sec.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* 계약 요약 카드 (항상 표시) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">{contract.projectName || "인테리어 공사"}</h1>
            </div>
            <span className="text-lg font-extrabold text-blue-600">{fmt(contract.totalAmount)}원</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            {contract.address && (
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.address}</span>
            )}
            {contract.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(contract.startDate).toLocaleDateString("ko-KR")} ~
                {contract.expectedEndDate && ` ${new Date(contract.expectedEndDate).toLocaleDateString("ko-KR")}`}
              </span>
            )}
            {contractor?.company_name && (
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contractor.company_name}</span>
            )}
          </div>
        </div>

        {/* 활성 섹션 */}
        {activeSection === 1 && <ContractPart1 contract={contract} contractor={contractor} />}
        {activeSection === 2 && <ContractPart2 contract={contract} onUpdateNotes={handleUpdateNotes} />}
        {activeSection === 3 && <ContractPart3 contract={contract} />}
        {activeSection === 4 && <ContractPart4 contract={contract} onSign={handleSign} contractor={contractor} />}

        {/* 시공도면 섹션 */}
        {activeSection === 5 && showDrawingSection && (
          <div className="space-y-4">
            {drawingMode === "idle" && !drawingResult && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <FileImage className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-2">시공도면 자동 생성</h3>
                <p className="text-sm text-gray-500 mb-5">
                  평면도 데이터를 기반으로 가구배치도, 전기배선도, 입면전개도를 자동 생성합니다.
                </p>
                <button
                  onClick={() => setDrawingMode("generating")}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  시공도면 생성하기
                </button>
              </div>
            )}

            {drawingMode === "generating" && (
              <DrawingGenerationProgress
                contractId={contract.id}
                onComplete={(result) => {
                  setDrawingResult({ drawings: result.drawings });
                  setDrawingMode("viewing");
                }}
                onCancel={() => setDrawingMode("idle")}
              />
            )}

            {(drawingMode === "viewing" || drawingResult) && drawingResult && (
              <DrawingViewer
                drawings={drawingResult.drawings}
                onDownloadPdf={async () => {
                  try {
                    await generateConstructionDrawingPdf(
                      drawingResult.drawings,
                      {
                        projectName: contract.projectName || "인테리어 공사",
                        address: contract.address || "",
                        area: Number((contract as unknown as Record<string, unknown>).area) || 84,
                        date: new Date().toLocaleDateString("ko-KR"),
                        contractId: contract.id,
                      }
                    );
                  } catch {
                    toast({ type: "error", title: "오류", message: "PDF 생성에 실패했습니다" });
                  }
                }}
              />
            )}
          </div>
        )}

        {/* 시공사 정보 */}
        {contractor && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">시공사 정보</h3>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{contractor.company_name}</p>
                <p className="text-xs text-gray-500">{contractor.contact_name}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 text-xs text-gray-500">
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

        {/* 시공 일정 */}
        {schedule && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-blue-600" /> 시공 일정
            </h3>
            <ScheduleOverview schedule={schedule} />
          </div>
        )}

        {/* 실시간 채팅 */}
        {chatUserId && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">실시간 채팅</h3>
              <span className="text-xs text-gray-400">· {chatOtherName}</span>
            </div>
            <ChatWindow
              roomId={contract.id}
              currentUserId={chatUserId}
              currentUserType={chatUserType}
              currentUserName={chatUserName}
              className="border-0 rounded-none"
            />
          </div>
        )}

        {/* 결제 일정 */}
        <PaymentTimeline contract={contract} />

        {/* 계약 체결 완료 배너 */}
        {contract.status === "SIGNED" && (
          <div className="bg-green-600 text-white rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-80" />
            <h3 className="text-lg font-bold mb-1">계약이 체결되었습니다</h3>
            <p className="text-sm text-green-100">
              {contract.signedAt && `${new Date(contract.signedAt).toLocaleDateString("ko-KR")} 서명 완료`}
            </p>
          </div>
        )}

        {/* 소비자 리뷰 작성 (계약 체결 후) */}
        {user && ["SIGNED", "IN_PROGRESS", "COMPLETED"].includes(contract.status) && (
          <ReviewSection contract={contract} userId={user.id} />
        )}
      </main>
    </div>
  );
}

export default function ContractDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ContractDetailContent />
    </Suspense>
  );
}
