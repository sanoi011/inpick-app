"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Download,
  Calculator,
  Home,
  ChefHat,
  Bed,
  Bath,
  DoorOpen,
  BarChart3,
  CheckCircle2,
  Loader2,
  Layers,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import CostTable, { type RoomCostSection, type CostItem } from "@/components/project/CostTable";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { ProjectEstimate } from "@/types/consumer-project";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import { adaptParsedFloorPlan } from "@/lib/floor-plan/quantity/adapter";
import { calculateAllQuantities } from "@/lib/floor-plan/quantity/quantity-calculator";
import { calculateEstimate, type EstimateResult } from "@/lib/floor-plan/quantity/estimate-calculator";
import { TRADE_NAMES } from "@/lib/floor-plan/quantity/types";

const UNIT_LABELS: Record<string, string> = {
  SQM: "m²", LM: "m", EA: "개", SET: "세트", LOT: "식",
  M3: "m³", KG: "kg", ROLL: "롤", CAN: "캔", BAG: "포",
};

// QTY 엔진 결과 → CostTable용 RoomCostSection[] 변환 (공간별 뷰)
function convertToRoomSections(result: EstimateResult): RoomCostSection[] {
  const roomMap = new Map<string, CostItem[]>();

  for (const line of result.lines) {
    const key = line.roomName || "공통";
    if (!roomMap.has(key)) roomMap.set(key, []);
    const overhead = Math.round(line.totalAmount * 0.1); // 간접비 배분
    roomMap.get(key)!.push({
      id: `${line.itemCode}-${line.roomName || "common"}`,
      category: TRADE_NAMES[line.tradeCode] || line.tradeCode,
      part: line.specification,
      productName: line.itemName,
      method: "시공",
      spec: line.specification,
      unit: UNIT_LABELS[line.unit] || line.unit,
      quantity: line.quantity,
      materialCost: line.materialAmount,
      laborCost: line.laborAmount,
      overhead,
      total: line.totalAmount + overhead,
      note: "",
    });
  }

  const sections: RoomCostSection[] = [];
  for (const [roomName, items] of Array.from(roomMap.entries())) {
    sections.push({
      roomName,
      items,
      subtotal: items.reduce((sum, i) => sum + i.total, 0),
    });
  }

  return sections;
}

// QTY 엔진 결과 → CostTable용 RoomCostSection[] 변환 (공종별 뷰)
function convertToTradeSections(result: EstimateResult): RoomCostSection[] {
  const tradeMap = new Map<string, CostItem[]>();

  for (const line of result.lines) {
    const tradeName = TRADE_NAMES[line.tradeCode] || line.tradeCode;
    if (!tradeMap.has(tradeName)) tradeMap.set(tradeName, []);
    const overhead = Math.round(line.totalAmount * 0.1);
    tradeMap.get(tradeName)!.push({
      id: `${line.itemCode}-${line.roomName || "common"}`,
      category: tradeName,
      part: line.roomName || "공통",
      productName: line.itemName,
      method: "시공",
      spec: line.specification,
      unit: UNIT_LABELS[line.unit] || line.unit,
      quantity: line.quantity,
      materialCost: line.materialAmount,
      laborCost: line.laborAmount,
      overhead,
      total: line.totalAmount + overhead,
      note: "",
    });
  }

  const sections: RoomCostSection[] = [];
  for (const [tradeName, items] of Array.from(tradeMap.entries())) {
    sections.push({
      roomName: tradeName,
      items,
      subtotal: items.reduce((sum, i) => sum + i.total, 0),
    });
  }

  return sections;
}

// 도면 없을 때 기본 Mock 견적 (폴백)
function generateFallbackEstimate(floorPlan: ParsedFloorPlan | null): RoomCostSection[] {
  if (!floorPlan) return [];

  return floorPlan.rooms
    .filter((r) => r.area >= 2)
    .map((room) => {
      const q = Math.round(room.area);
      const items: CostItem[] = [
        { id: `${room.id}-demo`, category: "철거", part: "전체", productName: "기존 마감 철거", method: "철거", spec: "-", unit: "m²", quantity: q, materialCost: 0, laborCost: q * 8000, overhead: q * 800, total: q * 8800, note: "" },
        { id: `${room.id}-floor`, category: "바닥재", part: "바닥", productName: "강마루", method: "시공", spec: "중급", unit: "m²", quantity: q, materialCost: q * 35000, laborCost: q * 15000, overhead: q * 5000, total: q * 55000, note: "" },
        { id: `${room.id}-wall`, category: "도배", part: "벽", productName: "실크 벽지", method: "도배", spec: "합지", unit: "m²", quantity: q * 3, materialCost: q * 3 * 5000, laborCost: q * 3 * 8000, overhead: q * 3 * 1300, total: q * 3 * 14300, note: "" },
        { id: `${room.id}-ceiling`, category: "천장", part: "천장", productName: "석고보드+도장", method: "시공", spec: "9.5T", unit: "m²", quantity: q, materialCost: q * 17000, laborCost: q * 29000, overhead: q * 4600, total: q * 50600, note: "" },
      ];

      return {
        roomName: room.name,
        items,
        subtotal: items.reduce((sum, i) => sum + i.total, 0),
      };
    });
}

const ROOM_ICONS: Record<string, React.ElementType> = {
  거실: Home,
  주방: ChefHat,
  안방: Bed,
  침실: Bed,
  욕실: Bath,
  현관: DoorOpen,
};

const ROOM_COLORS: Record<string, string> = {
  거실: "bg-blue-500",
  주방: "bg-amber-500",
  안방: "bg-purple-500",
  침실: "bg-indigo-500",
  욕실: "bg-teal-500",
  현관: "bg-orange-500",
  발코니: "bg-green-500",
  드레스룸: "bg-pink-500",
  다용도실: "bg-gray-500",
};

export default function EstimatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, setEstimate } = useProjectState(projectId);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [viewMode, setViewMode] = useState<"room" | "trade">("room");

  // 도면 로드
  useEffect(() => {
    if (project?.drawingId) {
      loadFloorPlan(project.drawingId).then((plan) => {
        if (plan) setFloorPlan(plan);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [project?.drawingId]);

  // QTY 엔진 기반 견적 생성
  const useEngine = !!floorPlan;

  const { sections, totalMaterial, totalLabor, totalOverhead, grandTotal, summary, engineResult } = useMemo(() => {
    let secs: RoomCostSection[];
    let estResult: EstimateResult | null = null;

    if (useEngine && floorPlan) {
      // QTY 엔진 실행
      const fpp = adaptParsedFloorPlan(floorPlan, projectId);
      const qtyResult = calculateAllQuantities(fpp);
      estResult = calculateEstimate(qtyResult);

      secs = viewMode === "trade"
        ? convertToTradeSections(estResult)
        : convertToRoomSections(estResult);
    } else {
      secs = generateFallbackEstimate(floorPlan);
    }

    const gt = estResult
      ? estResult.summary.grandTotal
      : secs.reduce((sum, s) => sum + s.subtotal, 0);
    const tm = estResult
      ? estResult.summary.directMaterialCost
      : secs.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.materialCost, 0), 0);
    const tl = estResult
      ? estResult.summary.directLaborCost
      : secs.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.laborCost, 0), 0);
    const to = estResult
      ? (estResult.summary.overheadAmount + estResult.summary.profitAmount + estResult.summary.vatAmount)
      : secs.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.overhead, 0), 0);

    const smry = secs.map((s) => ({
      label: s.roomName,
      amount: s.subtotal,
      color: ROOM_COLORS[s.roomName] || "bg-gray-500",
    }));

    return {
      sections: secs,
      totalMaterial: tm,
      totalLabor: tl,
      totalOverhead: to,
      grandTotal: gt,
      summary: smry,
      engineResult: estResult,
    };
  }, [useEngine, floorPlan, projectId, viewMode]);

  // 물량산출 결과 로깅 (fire-and-forget, 1회만)
  const [qtyLogged, setQtyLogged] = useState(false);
  useEffect(() => {
    if (!engineResult || qtyLogged) return;
    setQtyLogged(true);
    fetch("/api/quantity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        floorPlanData: floorPlan,
        quantityResult: { projectId, itemCount: engineResult.lines.length },
        estimateResult: engineResult.summary,
        totalItems: engineResult.lines.length,
        grandTotal: engineResult.summary.grandTotal,
      }),
    }).catch(() => { /* silent */ });
  }, [engineResult, qtyLogged, projectId, floorPlan]);

  const filteredSections = activeRoom
    ? sections.filter((s) => s.roomName === activeRoom)
    : sections;

  // 견적 저장 + 다음 단계
  const handleSaveAndNext = useCallback(() => {
    const estimate: ProjectEstimate = {
      items: sections.flatMap((s) =>
        s.items.map((item) => ({
          id: item.id,
          roomId: "",
          roomName: s.roomName,
          category: item.category,
          part: item.part,
          materialName: item.productName,
          specification: item.spec,
          unit: item.unit,
          quantity: item.quantity,
          materialCost: item.materialCost,
          laborCost: item.laborCost,
          expense: item.overhead,
          total: item.total,
        }))
      ),
      totalMaterialCost: totalMaterial,
      totalLaborCost: totalLabor,
      totalExpense: totalOverhead,
      grandTotal,
      createdAt: new Date().toISOString(),
    };

    setEstimate(estimate);
    setSaved(true);

    setTimeout(() => {
      router.push(`/project/${projectId}/rfq`);
    }, 500);
  }, [sections, totalMaterial, totalLabor, totalOverhead, grandTotal, setEstimate, router, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-50">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push(`/project/${projectId}/rendering`)}
            className="hidden sm:flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 3D 렌더링
          </button>
          <div className="hidden sm:block w-px h-4 bg-gray-300" />
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
            <Calculator className="w-4 h-4 text-amber-600" />
            물량산출
          </h2>
          {useEngine && (
            <span className="hidden sm:flex px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 17개 공종 산출
            </span>
          )}
          {!useEngine && floorPlan && (
            <span className="hidden sm:inline px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
              기본 단가 적용
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>
          <button
            onClick={handleSaveAndNext}
            disabled={sections.length === 0}
            className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> 저장됨
              </>
            ) : (
              <>
                견적요청 <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 요약 토글 */}
      {sections.length > 0 && (
        <button
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="md:hidden flex items-center justify-between w-full px-4 py-2 bg-white border-b border-gray-200 text-sm"
        >
          <span className="font-medium text-gray-900">
            공사비 합계: {grandTotal.toLocaleString("ko-KR")}원
          </span>
          <span className="text-xs text-blue-600">{showMobileSummary ? "접기" : "상세 보기"}</span>
        </button>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* 좌측: 요약 패널 */}
        <div className={`w-full md:w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto ${
          showMobileSummary ? "block" : "hidden md:block"
        }`}>
          {/* 총 비용 */}
          <div className="p-4 border-b border-gray-200">
            <p className="text-xs text-gray-500 mb-1">공사비 합계 (VAT 별도)</p>
            <p className="text-2xl font-bold text-gray-900">
              {grandTotal.toLocaleString("ko-KR")}
              <span className="text-sm font-normal text-gray-500 ml-1">원</span>
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">재료비</span>
                <span className="text-gray-900 font-medium">{totalMaterial.toLocaleString("ko-KR")}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">노무비</span>
                <span className="text-gray-900 font-medium">{totalLabor.toLocaleString("ko-KR")}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">경비</span>
                <span className="text-gray-900 font-medium">{totalOverhead.toLocaleString("ko-KR")}원</span>
              </div>
            </div>
          </div>

          {/* 공간별 비중 */}
          {summary.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-1 mb-3">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-600">공간별 비용 비중</span>
              </div>

              {/* 가로 막대 차트 */}
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {summary.map((s) => (
                  <div
                    key={s.label}
                    className={`${s.color} transition-all`}
                    style={{ width: `${grandTotal > 0 ? (s.amount / grandTotal) * 100 : 0}%` }}
                    title={`${s.label}: ${s.amount.toLocaleString("ko-KR")}원`}
                  />
                ))}
              </div>

              {/* 범례 */}
              <div className="space-y-1.5">
                {summary.map((s) => {
                  const Icon = ROOM_ICONS[s.label] || Home;
                  const pct = grandTotal > 0 ? ((s.amount / grandTotal) * 100).toFixed(1) : "0";
                  return (
                    <button
                      key={s.label}
                      onClick={() =>
                        setActiveRoom((prev) => (prev === s.label ? null : s.label))
                      }
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                        activeRoom === s.label
                          ? "bg-blue-50 ring-1 ring-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${s.color}`} />
                      <Icon className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-medium text-gray-700 flex-1">{s.label}</span>
                      <span className="text-[10px] text-gray-400">{pct}%</span>
                      <span className="text-xs font-medium text-gray-900">
                        {(s.amount / 10000).toFixed(0)}만
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 산출 기준 */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">산출 기준</p>
            <div className="space-y-1 text-[11px] text-gray-500">
              {useEngine ? (
                <>
                  <p>- 17개 공종 정밀 물량산출 엔진</p>
                  <p>- 단가: 2025년 서울 실거래 기준</p>
                  <p>- 일반관리비: 직접공사비 × 6%</p>
                  <p>- 이윤: (직접공사비+관리비) × 5%</p>
                  <p>- VAT: 공급가액 × 10%</p>
                  <p>- 할증률: 공종별 자재 로스 반영</p>
                </>
              ) : (
                <>
                  <p>- 단가: 2025년 물가정보 기준</p>
                  <p>- 노무비: 자재비 × 카테고리별 비율</p>
                  <p>- 경비: (재료비+노무비) × 10%</p>
                  <p>- VAT 별도, 부대비용 별도</p>
                </>
              )}
              <p>- 실측 후 물량 변동 가능</p>
            </div>
            {engineResult && (
              <div className="mt-3 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-500">
                  <span>일반관리비 ({engineResult.summary.overheadRate}%)</span>
                  <span>{engineResult.summary.overheadAmount.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>이윤 ({engineResult.summary.profitRate}%)</span>
                  <span>{engineResult.summary.profitAmount.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>부가세 ({engineResult.summary.vatRate}%)</span>
                  <span>{engineResult.summary.vatAmount.toLocaleString("ko-KR")}원</span>
                </div>
              </div>
            )}
            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-[10px] text-amber-700">
                ※ 본 견적은 참고 금액이며, 실제 시공 시 현장 상황에 따라 변동됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 우측: 견적 테이블 */}
        <div className="flex-1 overflow-y-auto p-4">
          {sections.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">견적 데이터가 없습니다</p>
                <p className="text-xs mt-1">
                  이전 단계에서 자재를 선택하고 렌더링을 확인해주세요
                </p>
                <button
                  onClick={() => router.push(`/project/${projectId}/rendering`)}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  3D 렌더링으로 이동
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 뷰 모드 + 필터 탭 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {useEngine && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
                    <button
                      onClick={() => { setViewMode("room"); setActiveRoom(null); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        viewMode === "room" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      }`}
                    >
                      공간별
                    </button>
                    <button
                      onClick={() => { setViewMode("trade"); setActiveRoom(null); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                        viewMode === "trade" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      }`}
                    >
                      <Layers className="w-3 h-3" /> 공종별
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setActiveRoom(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    !activeRoom
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  전체
                </button>
                {sections.map((s) => {
                  const Icon = ROOM_ICONS[s.roomName] || Home;
                  return (
                    <button
                      key={s.roomName}
                      onClick={() =>
                        setActiveRoom((prev) => (prev === s.roomName ? null : s.roomName))
                      }
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeRoom === s.roomName
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {s.roomName}
                    </button>
                  );
                })}
                <span className="ml-auto text-xs text-gray-400">
                  총 {filteredSections.reduce((sum, s) => sum + s.items.length, 0)}개 항목
                </span>
              </div>

              {/* 견적 테이블 */}
              <CostTable sections={filteredSections} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
