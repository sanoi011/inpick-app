"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
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
  AlertTriangle,
  Ruler,
  Plus,
  X,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import dynamic from "next/dynamic";
import type { RoomCostSection, CostItem } from "@/components/project/CostTable";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { ProjectEstimate, SelectedMaterial } from "@/types/consumer-project";
import { isStatusAtLeast } from "@/types/consumer-project";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import { adaptParsedFloorPlan } from "@/lib/floor-plan/quantity/adapter";
import { calculateAllQuantities } from "@/lib/floor-plan/quantity/quantity-calculator";
import { calculateEstimate, type EstimateResult } from "@/lib/floor-plan/quantity/estimate-calculator";
import { TRADE_NAMES } from "@/lib/floor-plan/quantity/types";
import { generateSyntheticFloorPlan } from "@/lib/floor-plan/quantity/synthetic-floorplan";

const CostTable = dynamic(() => import("@/components/project/CostTable"), {
  loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>,
});

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

  // 단계 잠금: 최소 RENDERING 단계 이상이어야 접근 가능
  // (자재 미선택 시에도 AI 추천으로 자동 생성하므로 RENDERING부터 허용)
  useEffect(() => {
    if (!project) return;
    if (!isStatusAtLeast(project.status, "FLOOR_PLAN")) {
      router.replace(`/project/${projectId}/home`);
    }
  }, [project, projectId, router]);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [viewMode, setViewMode] = useState<"room" | "trade">("room");
  const [ceilingHeight, setCeilingHeight] = useState(2200); // mm 기본값

  // AI 자재 추천 상태
  const [aiMaterials, setAiMaterials] = useState<SelectedMaterial[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDesignConcept, setAiDesignConcept] = useState<string>("");

  // 도면 로드 (실제 도면 or 합성 평면도)
  useEffect(() => {
    if (project?.drawingId) {
      loadFloorPlan(project.drawingId).then((plan) => {
        if (plan) setFloorPlan(plan);
        setLoading(false);
      });
    } else {
      // 도면 없을 때: 면적 기반 합성 평면도 생성
      const area = project?.address?.exclusiveArea || 84;
      const roomCount = project?.address?.roomCount;
      const bathroomCount = project?.address?.bathroomCount;
      const synthetic = generateSyntheticFloorPlan(area, roomCount, bathroomCount);
      setFloorPlan(synthetic);
      setLoading(false);
    }
  }, [project?.drawingId, project?.address?.exclusiveArea, project?.address?.roomCount, project?.address?.bathroomCount]);

  // 사용자 선택 자재 (AI 디자인 자재 연동)
  const manualMaterials = useMemo(
    () => project?.rendering?.materials || [],
    [project?.rendering?.materials]
  );

  // AI 자재 추천 자동 호출 (사용자 선택 자재가 없을 때)
  const [aiRequested, setAiRequested] = useState(false);
  useEffect(() => {
    if (aiRequested || manualMaterials.length > 0 || aiLoading || aiMaterials.length > 0) return;
    if (!project) return;
    setAiRequested(true);
    setAiLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    fetch("/api/project/estimate-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        floorPlanImageUrl: project.floorPlanImageUrl || null,
        designPreferences: project.designPreferences || { style: "모던", budget: "standard", priorities: [] },
        area: project.address?.exclusiveArea || 84,
        roomCount: project.address?.roomCount || 3,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.materials && data.materials.length > 0) {
          // AIMaterial[] → SelectedMaterial[] 변환
          const converted: SelectedMaterial[] = data.materials.map((m: { categoryCode: string; category: string; materialName: string; brand: string; specification: string; unitPrice: number; laborPrice: number; unit: string; priceGrade: string }, i: number) => ({
            id: `ai-${m.categoryCode}-${i}`,
            roomId: "",
            roomName: "",
            category: m.category,
            categoryCode: m.categoryCode,
            part: m.category,
            materialName: m.materialName,
            specification: m.specification,
            unitPrice: m.unitPrice,
            laborPrice: m.laborPrice,
            unit: m.unit,
            brand: m.brand,
            priceGrade: m.priceGrade as "economy" | "standard" | "premium",
            priceSource: "AI 추천",
            confirmed: true,
          }));
          setAiMaterials(converted);
          if (data.designConcept) setAiDesignConcept(data.designConcept);
        }
      })
      .catch(() => { /* silent fallback - engine will use default prices */ })
      .finally(() => { clearTimeout(timeout); setAiLoading(false); });
  }, [project, manualMaterials.length, aiRequested, aiLoading, aiMaterials.length]);

  // 최종 자재: 사용자 선택 우선, 없으면 AI 추천
  const userMaterials = manualMaterials.length > 0 ? manualMaterials : aiMaterials;

  // 높이 할증 여부
  const isHeightSurcharge = ceilingHeight > 2500;

  // QTY 엔진 기반 견적 생성 (합성 평면도 포함하므로 항상 사용 가능)
  const useEngine = !!floorPlan;
  const isSyntheticPlan = !project?.drawingId && !!floorPlan;
  const isAiMaterialsUsed = manualMaterials.length === 0 && aiMaterials.length > 0;

  const { sections, totalMaterial, totalLabor, totalOverhead, grandTotal, summary, engineResult } = useMemo(() => {
    let secs: RoomCostSection[];
    let estResult: EstimateResult | null = null;

    if (useEngine && floorPlan) {
      // QTY 엔진 실행 (오류 시 폴백)
      try {
        const fpp = adaptParsedFloorPlan(floorPlan, projectId, '인테리어 공사');
        const qtyResult = calculateAllQuantities(fpp);
        estResult = calculateEstimate(qtyResult, {
          ceilingHeight,
          materialOverrides: userMaterials.length > 0 ? userMaterials : undefined,
        });

        secs = viewMode === "trade"
          ? convertToTradeSections(estResult)
          : convertToRoomSections(estResult);
      } catch {
        secs = generateFallbackEstimate(floorPlan);
      }
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
  }, [useEngine, floorPlan, projectId, viewMode, ceilingHeight, userMaterials]);

  // 편집 가능한 sections 상태 (내역 추가/삭제용)
  const [editedSections, setEditedSections] = useState<RoomCostSection[] | null>(null);
  const [addFormSection, setAddFormSection] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ category: '', productName: '', spec: '', unit: 'm²', quantity: '', materialCost: '', laborCost: '' });

  // 엔진 파라미터가 바뀌면 편집 상태 초기화 (뷰모드 변경은 제외)
  useEffect(() => {
    setEditedSections(null);
  }, [ceilingHeight, floorPlan, userMaterials]);

  const activeSections = editedSections || sections;

  const handleAddItem = useCallback((sectionName: string) => {
    setAddFormSection(sectionName);
    setAddForm({ category: '', productName: '', spec: '', unit: 'm²', quantity: '', materialCost: '', laborCost: '' });
  }, []);

  const handleConfirmAdd = useCallback(() => {
    if (!addFormSection || !addForm.productName || !addForm.quantity) return;
    const qty = Number(addForm.quantity) || 0;
    const matCost = Number(addForm.materialCost) || 0;
    const labCost = Number(addForm.laborCost) || 0;
    const overhead = Math.round((matCost + labCost) * 0.1);

    const newItem: CostItem = {
      id: `custom-${Date.now()}`,
      category: addForm.category || '추가',
      part: '',
      productName: addForm.productName,
      method: '시공',
      spec: addForm.spec,
      unit: addForm.unit,
      quantity: qty,
      materialCost: matCost,
      laborCost: labCost,
      overhead,
      total: matCost + labCost + overhead,
    };

    const base = editedSections || [...sections];
    const updated = base.map(s => {
      if (s.roomName !== addFormSection) return s;
      const items = [...s.items, newItem];
      return { ...s, items, subtotal: items.reduce((sum, i) => sum + i.total, 0) };
    });
    setEditedSections(updated);
    setAddFormSection(null);
  }, [addFormSection, addForm, editedSections, sections]);

  const handleDeleteItem = useCallback((sectionName: string, itemId: string) => {
    const base = editedSections || [...sections];
    const updated = base.map(s => {
      if (s.roomName !== sectionName) return s;
      const items = s.items.filter(i => i.id !== itemId);
      return { ...s, items, subtotal: items.reduce((sum, i) => sum + i.total, 0) };
    }).filter(s => s.items.length > 0);
    setEditedSections(updated);
  }, [editedSections, sections]);

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
    ? activeSections.filter((s) => s.roomName === activeRoom)
    : activeSections;

  // 편집된 sections 기반 합계 재계산
  const activeGrandTotal = editedSections
    ? editedSections.reduce((sum, s) => sum + s.subtotal, 0)
    : grandTotal;

  // 견적 저장 + 다음 단계
  const handleSaveAndNext = useCallback(() => {
    const saveSections = activeSections;
    const saveMaterial = editedSections
      ? saveSections.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.materialCost, 0), 0)
      : totalMaterial;
    const saveLabor = editedSections
      ? saveSections.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.laborCost, 0), 0)
      : totalLabor;
    const saveOverhead = editedSections
      ? saveSections.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.overhead, 0), 0)
      : totalOverhead;
    const saveGrandTotal = editedSections ? activeGrandTotal : grandTotal;

    const estimate: ProjectEstimate = {
      items: saveSections.flatMap((s) =>
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
      totalMaterialCost: saveMaterial,
      totalLaborCost: saveLabor,
      totalExpense: saveOverhead,
      grandTotal: saveGrandTotal,
      createdAt: new Date().toISOString(),
    };

    setEstimate(estimate);
    setSaved(true);

    setTimeout(() => {
      router.push(`/project/${projectId}/rfq`);
    }, 500);
  }, [activeSections, editedSections, totalMaterial, totalLabor, totalOverhead, grandTotal, activeGrandTotal, setEstimate, router, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">도면 데이터를 불러오는 중...</p>
        </div>
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
            <ArrowLeft className="w-3.5 h-3.5" /> 자재 선택
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
          {isSyntheticPlan && (
            <span className="hidden sm:inline px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs font-medium rounded-full">
              면적 기반 추정
            </span>
          )}
          {aiLoading && (
            <span className="hidden sm:flex px-2 py-0.5 bg-purple-50 text-purple-600 text-xs font-medium rounded-full items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> AI 자재 추천 중...
            </span>
          )}
          {!aiLoading && isAiMaterialsUsed && (
            <span className="hidden sm:flex px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> AI 자재 추천
            </span>
          )}
        </div>

        {/* 층고 입력 + 할증 경고 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-200">
            <Ruler className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-600 hidden sm:inline">층고</span>
            <input
              type="number"
              value={ceilingHeight}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 2200;
                setCeilingHeight(Math.max(2000, Math.min(4000, v)));
              }}
              className="w-16 text-center text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              min={2000}
              max={4000}
              step={100}
            />
            <span className="text-xs text-gray-500">mm</span>
          </div>
          {isHeightSurcharge && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              <span className="hidden sm:inline">노무비 1.5배</span>
              <span className="sm:hidden">1.5x</span>
            </span>
          )}
          <button
            onClick={handleSaveAndNext}
            disabled={activeSections.length === 0}
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
      {activeSections.length > 0 && (
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
            <p className="text-xs text-gray-500 mb-1">공사비 합계 (VAT 포함)</p>
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
                <span className="text-gray-500">노무비{isHeightSurcharge ? " (1.5배)" : ""}</span>
                <span className={`font-medium ${isHeightSurcharge ? "text-red-600" : "text-gray-900"}`}>
                  {totalLabor.toLocaleString("ko-KR")}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">경비</span>
                <span className="text-gray-900 font-medium">{totalOverhead.toLocaleString("ko-KR")}원</span>
              </div>
            </div>
            {isHeightSurcharge && (
              <div className="mt-2 px-2 py-1.5 bg-red-50 rounded-lg border border-red-200">
                <p className="text-[10px] text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  층고 {ceilingHeight}mm &gt; 2500mm: 노무비 1.5배 할증 적용
                </p>
              </div>
            )}
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

          {/* AI 자재 추천 컨셉 */}
          {isAiMaterialsUsed && aiDesignConcept && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Calculator className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700">AI 자재 추천</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{aiDesignConcept}</p>
              <p className="text-[10px] text-gray-400 mt-2">
                {aiMaterials.length}개 자재 카테고리 자동 추천 적용
              </p>
            </div>
          )}

          {/* 산출 기준 */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">산출 기준</p>
            <div className="space-y-1 text-[11px] text-gray-500">
              {useEngine ? (
                <>
                  <p>- 17개 공종 정밀 물량산출 엔진</p>
                  <p>- 층고: {ceilingHeight}mm{isHeightSurcharge ? " (할증 적용)" : ""}</p>
                  <p>- 단가: 2026년 서울 실거래 기준</p>
                  <p>- 일반관리비: 직접공사비 x 6%</p>
                  <p>- 이윤: (직접공사비+관리비) x 5%</p>
                  <p>- VAT: 공급가액 x 10%</p>
                  <p>- 할증률: 공종별 자재 로스 반영</p>
                  {isHeightSurcharge && <p className="text-red-500">- 2500mm 초과 노무비 1.5배 할증</p>}
                </>
              ) : (
                <>
                  <p>- 단가: 2026년 물가정보 기준</p>
                  <p>- 노무비: 자재비 x 카테고리별 비율</p>
                  <p>- 경비: (재료비+노무비) x 10%</p>
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
            {isSyntheticPlan && (
              <div className="mt-2 px-3 py-2 bg-cyan-50 rounded-lg border border-cyan-200">
                <p className="text-[10px] text-cyan-700">
                  ※ 도면 미등록 - {project?.address?.exclusiveArea || 84}㎡ 표준 배치 기반 추정 견적입니다.
                </p>
              </div>
            )}
            {isAiMaterialsUsed && (
              <div className="mt-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-[10px] text-purple-700">
                  ※ AI 추천 자재가 적용되었습니다. 자재 선택 탭에서 직접 변경할 수 있습니다.
                </p>
              </div>
            )}
            <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-[10px] text-amber-700">
                ※ 본 견적은 참고 금액이며, 실제 시공 시 현장 상황에 따라 변동됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 우측: 견적 테이블 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSections.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Loader2 className="w-12 h-12 mx-auto mb-3 opacity-30 animate-spin" />
                <p className="text-sm font-medium">견적을 준비하고 있습니다...</p>
                <p className="text-xs mt-1">잠시만 기다려주세요</p>
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
                {activeSections.map((s) => {
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

              {/* 내역 추가 폼 */}
              {addFormSection && (
                <div className="mb-4 p-4 bg-white border border-blue-200 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">내역 추가 — {addFormSection}</h4>
                    <button onClick={() => setAddFormSection(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">공종</label>
                      <select
                        value={addForm.category}
                        onChange={(e) => setAddForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">선택</option>
                        {Object.values(TRADE_NAMES).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">품명 *</label>
                      <input
                        value={addForm.productName}
                        onChange={(e) => setAddForm(f => ({ ...f, productName: e.target.value }))}
                        placeholder="품명 입력"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">규격</label>
                      <input
                        value={addForm.spec}
                        onChange={(e) => setAddForm(f => ({ ...f, spec: e.target.value }))}
                        placeholder="규격"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">단위</label>
                      <select
                        value={addForm.unit}
                        onChange={(e) => setAddForm(f => ({ ...f, unit: e.target.value }))}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="m²">m²</option>
                        <option value="m">m</option>
                        <option value="개">개</option>
                        <option value="세트">세트</option>
                        <option value="식">식</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">수량 *</label>
                      <input
                        type="number"
                        value={addForm.quantity}
                        onChange={(e) => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                        placeholder="0"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">재료비 (원)</label>
                      <input
                        type="number"
                        value={addForm.materialCost}
                        onChange={(e) => setAddForm(f => ({ ...f, materialCost: e.target.value }))}
                        placeholder="0"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">노무비 (원)</label>
                      <input
                        type="number"
                        value={addForm.laborCost}
                        onChange={(e) => setAddForm(f => ({ ...f, laborCost: e.target.value }))}
                        placeholder="0"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAddFormSection(null)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleConfirmAdd}
                      disabled={!addForm.productName || !addForm.quantity}
                      className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> 추가
                    </button>
                  </div>
                </div>
              )}

              {/* 견적 테이블 */}
              <CostTable
                sections={filteredSections}
                editable={false}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
