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
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import CostTable, { type RoomCostSection, type CostItem } from "@/components/project/CostTable";
import type { ParsedFloorPlan } from "@/types/floorplan";
import type { SelectedMaterial, EstimateItem, ProjectEstimate } from "@/types/consumer-project";
import { loadFloorPlan } from "@/lib/services/drawing-service";

// 노무비 비율 (자재비 기준)
const LABOR_RATE: Record<string, number> = {
  바닥: 0.7,
  벽: 0.8,
  천장: 0.9,
  설비: 0.5,
  전기: 0.8,
  목공: 0.6,
};

// 경비 비율 (재료비+노무비 기준)
const OVERHEAD_RATE = 0.1;

// 철거비 (공간 유형별, m² 당)
const DEMOLITION_COST: Record<string, number> = {
  BATHROOM: 55000,
  KITCHEN: 15000,
  LIVING: 5500,
  BED: 5500,
  MASTER_BED: 5500,
  ENTRANCE: 8000,
  BALCONY: 4000,
};

// 확정 자재 기반 견적 생성
function generateEstimateFromMaterials(
  materials: SelectedMaterial[],
  floorPlan: ParsedFloorPlan | null
): { sections: RoomCostSection[]; estimateItems: EstimateItem[] } {
  // 방별로 그룹핑
  const roomMap = new Map<string, { roomId: string; roomName: string; materials: SelectedMaterial[] }>();

  for (const mat of materials) {
    if (!roomMap.has(mat.roomId)) {
      roomMap.set(mat.roomId, { roomId: mat.roomId, roomName: mat.roomName, materials: [] });
    }
    roomMap.get(mat.roomId)!.materials.push(mat);
  }

  const sections: RoomCostSection[] = [];
  const estimateItems: EstimateItem[] = [];

  for (const [roomId, group] of Array.from(roomMap.entries())) {
    const room = floorPlan?.rooms.find((r) => r.id === roomId);
    const area = room?.area || 20;
    const roomType = room?.type || "LIVING";
    const items: CostItem[] = [];

    // 1) 철거비 (공간당 1건)
    const demolitionRate = DEMOLITION_COST[roomType] || 5500;
    const demolitionItem: CostItem = {
      id: `${roomId}-demolition`,
      category: "철거",
      part: "전체",
      productName: `기존 마감재 철거`,
      method: "철거",
      spec: "-",
      unit: "m²",
      quantity: Math.round(area),
      materialCost: 0,
      laborCost: Math.round(area) * demolitionRate,
      overhead: Math.round(Math.round(area) * demolitionRate * OVERHEAD_RATE),
      total: Math.round(area) * demolitionRate + Math.round(Math.round(area) * demolitionRate * OVERHEAD_RATE),
      note: "",
    };
    items.push(demolitionItem);

    // 2) 각 자재별 산출
    for (const mat of group.materials) {
      const quantity = mat.quantity || Math.round(area);
      const materialCost = quantity * mat.unitPrice;
      const laborRate = LABOR_RATE[mat.category] || 0.7;
      const laborCost = Math.round(materialCost * laborRate);
      const overhead = Math.round((materialCost + laborCost) * OVERHEAD_RATE);
      const total = materialCost + laborCost + overhead;

      const mainItem: CostItem = {
        id: `${roomId}-${mat.category}-main`,
        category: "마감",
        part: mat.part,
        productName: mat.materialName,
        method: "시공",
        spec: mat.specification,
        unit: mat.unit,
        quantity,
        materialCost,
        laborCost,
        overhead,
        total,
        note: "",
      };
      items.push(mainItem);

      // 부자재
      if (mat.subMaterials) {
        for (const sub of mat.subMaterials) {
          const subQty = sub.quantity || quantity;
          const subMatCost = subQty * sub.unitPrice;
          const subLabor = Math.round(subMatCost * 0.5);
          const subOverhead = Math.round((subMatCost + subLabor) * OVERHEAD_RATE);
          const subTotal = subMatCost + subLabor + subOverhead;

          const subItem: CostItem = {
            id: `${roomId}-${mat.category}-sub-${sub.name}`,
            category: "부자재",
            part: mat.part,
            productName: sub.name,
            method: "시공",
            spec: sub.specification,
            unit: sub.unit,
            quantity: subQty,
            materialCost: subMatCost,
            laborCost: subLabor,
            overhead: subOverhead,
            total: subTotal,
            note: "",
          };
          items.push(subItem);
        }
      }

      // EstimateItem 저장용
      estimateItems.push({
        id: `${roomId}-${mat.category}`,
        roomId: mat.roomId,
        roomName: mat.roomName,
        category: mat.category,
        part: mat.part,
        materialName: mat.materialName,
        specification: mat.specification,
        unit: mat.unit,
        quantity,
        materialCost,
        laborCost,
        expense: overhead,
        total,
      });
    }

    sections.push({
      roomName: group.roomName,
      items,
      subtotal: items.reduce((sum, i) => sum + i.total, 0),
    });
  }

  return { sections, estimateItems };
}

// 자재가 없을 때 기본 Mock 견적
function generateDefaultEstimate(floorPlan: ParsedFloorPlan | null): RoomCostSection[] {
  if (!floorPlan) return [];

  return floorPlan.rooms
    .filter((r) => r.area >= 2)
    .map((room) => {
      const q = Math.round(room.area);
      const items: CostItem[] = [
        {
          id: `${room.id}-demo`,
          category: "철거",
          part: "전체",
          productName: "기존 마감 철거",
          method: "철거",
          spec: "-",
          unit: "m²",
          quantity: q,
          materialCost: 0,
          laborCost: q * 8000,
          overhead: q * 800,
          total: q * 8800,
          note: "",
        },
        {
          id: `${room.id}-floor`,
          category: "마감",
          part: "바닥",
          productName: "강화마루",
          method: "시공",
          spec: "12mm 오크",
          unit: "m²",
          quantity: q,
          materialCost: q * 35000,
          laborCost: q * 24500,
          overhead: q * 5950,
          total: q * 65450,
          note: "",
        },
        {
          id: `${room.id}-wall`,
          category: "마감",
          part: "벽",
          productName: "실크 벽지",
          method: "도배",
          spec: "LG하우시스",
          unit: "m²",
          quantity: q * 3,
          materialCost: q * 3 * 12000,
          laborCost: q * 3 * 9600,
          overhead: q * 3 * 2160,
          total: q * 3 * 23760,
          note: "",
        },
        {
          id: `${room.id}-ceiling`,
          category: "마감",
          part: "천장",
          productName: "도장",
          method: "페인트",
          spec: "수성페인트",
          unit: "m²",
          quantity: q,
          materialCost: q * 8000,
          laborCost: q * 7200,
          overhead: q * 1520,
          total: q * 16720,
          note: "",
        },
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

  // 자재 데이터에서 견적 생성
  const confirmedMaterials = project?.rendering?.materials || [];
  const hasMaterials = confirmedMaterials.length > 0;

  const { sections, totalMaterial, totalLabor, totalOverhead, grandTotal, summary } = useMemo(() => {
    let secs: RoomCostSection[];

    if (hasMaterials) {
      const result = generateEstimateFromMaterials(confirmedMaterials, floorPlan);
      secs = result.sections;
    } else {
      secs = generateDefaultEstimate(floorPlan);
    }

    const gt = secs.reduce((sum, s) => sum + s.subtotal, 0);
    const tm = secs.reduce(
      (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.materialCost, 0),
      0
    );
    const tl = secs.reduce(
      (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.laborCost, 0),
      0
    );
    const to = secs.reduce(
      (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.overhead, 0),
      0
    );

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
    };
  }, [hasMaterials, confirmedMaterials, floorPlan]);

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
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}/rendering`)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 3D 렌더링
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-amber-600" />
            물량산출 / 견적
          </h2>
          {hasMaterials && (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 확정 자재 기반
            </span>
          )}
          {!hasMaterials && floorPlan && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
              기본 단가 적용 (자재 미선택)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 좌측: 요약 패널 */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
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
              <p>- 단가: 2026년 물가정보 기준</p>
              <p>- 노무비: 자재비 × 카테고리별 비율</p>
              <p>- 경비: (재료비+노무비) × 10%</p>
              <p>- VAT 별도, 부대비용 별도</p>
              <p>- 실측 후 물량 변동 가능</p>
            </div>
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
              {/* 공간 필터 탭 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
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
