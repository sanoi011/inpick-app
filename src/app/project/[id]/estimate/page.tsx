"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import CostTable, { type RoomCostSection, type CostItem } from "@/components/project/CostTable";

// Mock 견적 데이터 생성
function generateMockEstimate(): {
  sections: RoomCostSection[];
  summary: { label: string; amount: number; color: string }[];
} {
  const rooms: {
    name: string;
    items: Omit<CostItem, "id">[];
  }[] = [
    {
      name: "거실",
      items: [
        { category: "철거", part: "바닥", productName: "기존 장판 철거", method: "철거", spec: "-", unit: "㎡", quantity: 25, materialCost: 0, laborCost: 125000, overhead: 12500, total: 137500, note: "" },
        { category: "마감", part: "바닥", productName: "LX하우시스 디아망 오크", method: "시공", spec: "1210×192×8mm", unit: "㎡", quantity: 25, materialCost: 375000, laborCost: 250000, overhead: 62500, total: 687500, note: "E0등급" },
        { category: "마감", part: "벽", productName: "실크벽지 (LG하우시스)", method: "도배", spec: "106cm×15.6m", unit: "롤", quantity: 12, materialCost: 180000, laborCost: 240000, overhead: 42000, total: 462000, note: "" },
        { category: "마감", part: "천장", productName: "실크벽지 (LG하우시스)", method: "도배", spec: "106cm×15.6m", unit: "롤", quantity: 6, materialCost: 90000, laborCost: 120000, overhead: 21000, total: 231000, note: "" },
        { category: "전기", part: "천장", productName: "LED 매입 다운라이트", method: "설치", spec: "Φ125 12W", unit: "개", quantity: 6, materialCost: 96000, laborCost: 180000, overhead: 27600, total: 303600, note: "" },
        { category: "마감", part: "벽", productName: "걸레받이 (PVC)", method: "시공", spec: "80mm", unit: "m", quantity: 18, materialCost: 36000, laborCost: 54000, overhead: 9000, total: 99000, note: "" },
      ],
    },
    {
      name: "주방",
      items: [
        { category: "철거", part: "벽", productName: "기존 타일 철거", method: "철거", spec: "-", unit: "㎡", quantity: 8, materialCost: 0, laborCost: 80000, overhead: 8000, total: 88000, note: "" },
        { category: "마감", part: "벽", productName: "포세린 타일 (300×600)", method: "타일", spec: "300×600mm", unit: "㎡", quantity: 8, materialCost: 240000, laborCost: 320000, overhead: 56000, total: 616000, note: "백색무광" },
        { category: "마감", part: "바닥", productName: "포세린 타일 (600×600)", method: "타일", spec: "600×600mm", unit: "㎡", quantity: 6, materialCost: 210000, laborCost: 240000, overhead: 45000, total: 495000, note: "" },
        { category: "목공", part: "천장", productName: "싱크대 상부장 교체", method: "설치", spec: "2.4m", unit: "식", quantity: 1, materialCost: 450000, laborCost: 300000, overhead: 75000, total: 825000, note: "" },
        { category: "전기", part: "천장", productName: "펜던트 조명", method: "설치", spec: "E26 소켓", unit: "개", quantity: 2, materialCost: 120000, laborCost: 60000, overhead: 18000, total: 198000, note: "" },
      ],
    },
    {
      name: "안방",
      items: [
        { category: "철거", part: "바닥", productName: "기존 장판 철거", method: "철거", spec: "-", unit: "㎡", quantity: 16, materialCost: 0, laborCost: 80000, overhead: 8000, total: 88000, note: "" },
        { category: "마감", part: "바닥", productName: "한화 아쿠아텍 자작나무", method: "시공", spec: "1200×190×8mm", unit: "㎡", quantity: 16, materialCost: 208000, laborCost: 160000, overhead: 36800, total: 404800, note: "방수" },
        { category: "마감", part: "벽", productName: "합지벽지 (수입)", method: "도배", spec: "53cm×10m", unit: "롤", quantity: 10, materialCost: 200000, laborCost: 200000, overhead: 40000, total: 440000, note: "포인트" },
        { category: "마감", part: "천장", productName: "실크벽지", method: "도배", spec: "106cm×15.6m", unit: "롤", quantity: 4, materialCost: 60000, laborCost: 80000, overhead: 14000, total: 154000, note: "" },
        { category: "목공", part: "벽", productName: "붙박이장 (슬라이딩)", method: "설치", spec: "2.4m×H2.4m", unit: "식", quantity: 1, materialCost: 800000, laborCost: 400000, overhead: 120000, total: 1320000, note: "" },
        { category: "전기", part: "천장", productName: "LED 매입등", method: "설치", spec: "Φ100 8W", unit: "개", quantity: 4, materialCost: 48000, laborCost: 120000, overhead: 16800, total: 184800, note: "" },
      ],
    },
    {
      name: "욕실",
      items: [
        { category: "철거", part: "전체", productName: "기존 욕실 철거", method: "철거", spec: "-", unit: "식", quantity: 1, materialCost: 0, laborCost: 350000, overhead: 35000, total: 385000, note: "" },
        { category: "방수", part: "바닥", productName: "우레탄 방수", method: "시공", spec: "2회 도포", unit: "㎡", quantity: 4, materialCost: 60000, laborCost: 80000, overhead: 14000, total: 154000, note: "" },
        { category: "마감", part: "벽", productName: "욕실 타일 (200×200)", method: "타일", spec: "200×200mm", unit: "㎡", quantity: 12, materialCost: 240000, laborCost: 360000, overhead: 60000, total: 660000, note: "" },
        { category: "마감", part: "바닥", productName: "욕실 바닥 타일", method: "타일", spec: "200×200mm", unit: "㎡", quantity: 4, materialCost: 80000, laborCost: 120000, overhead: 20000, total: 220000, note: "논슬립" },
        { category: "설비", part: "전체", productName: "욕실 세트 (양변기+세면대+샤워기)", method: "설치", spec: "대림바스", unit: "식", quantity: 1, materialCost: 650000, laborCost: 250000, overhead: 90000, total: 990000, note: "" },
        { category: "전기", part: "천장", productName: "방습 LED 등", method: "설치", spec: "IP44", unit: "개", quantity: 2, materialCost: 40000, laborCost: 60000, overhead: 10000, total: 110000, note: "" },
      ],
    },
    {
      name: "현관",
      items: [
        { category: "마감", part: "바닥", productName: "포세린 타일 (300×300)", method: "타일", spec: "300×300mm", unit: "㎡", quantity: 2, materialCost: 50000, laborCost: 60000, overhead: 11000, total: 121000, note: "" },
        { category: "마감", part: "벽", productName: "실크벽지", method: "도배", spec: "106cm×15.6m", unit: "롤", quantity: 2, materialCost: 30000, laborCost: 40000, overhead: 7000, total: 77000, note: "" },
        { category: "목공", part: "벽", productName: "신발장 (빌트인)", method: "설치", spec: "1.2m×H2.1m", unit: "식", quantity: 1, materialCost: 350000, laborCost: 200000, overhead: 55000, total: 605000, note: "" },
      ],
    },
  ];

  const sections: RoomCostSection[] = rooms.map((room) => {
    const items: CostItem[] = room.items.map((item, idx) => ({
      ...item,
      id: `${room.name}-${idx}`,
    }));
    return {
      roomName: room.name,
      items,
      subtotal: items.reduce((sum, i) => sum + i.total, 0),
    };
  });

  const summary = sections.map((s) => ({
    label: s.roomName,
    amount: s.subtotal,
    color:
      s.roomName === "거실"
        ? "bg-blue-500"
        : s.roomName === "주방"
          ? "bg-amber-500"
          : s.roomName === "안방"
            ? "bg-purple-500"
            : s.roomName === "욕실"
              ? "bg-teal-500"
              : "bg-gray-500",
  }));

  return { sections, summary };
}

const ROOM_ICONS: Record<string, React.ElementType> = {
  거실: Home,
  주방: ChefHat,
  안방: Bed,
  욕실: Bath,
  현관: DoorOpen,
};

export default function EstimatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project } = useProjectState(projectId);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const { sections, summary } = generateMockEstimate();

  const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);
  const totalMaterial = sections.reduce(
    (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.materialCost, 0),
    0
  );
  const totalLabor = sections.reduce(
    (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.laborCost, 0),
    0
  );
  const totalOverhead = sections.reduce(
    (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.overhead, 0),
    0
  );

  const filteredSections = activeRoom
    ? sections.filter((s) => s.roomName === activeRoom)
    : sections;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-50">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}/design`)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> 디자인
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-600" />
            견적산출
          </h2>
          {project?.address && (
            <span className="text-xs text-gray-400">
              {project.address.roadAddress} ({project.address.exclusiveArea}㎡)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
            <Download className="w-4 h-4" /> 내보내기
          </button>
          <button
            onClick={() => router.push(`/project/${projectId}/bids`)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            견적받기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 좌측: 요약 패널 */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
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
                  style={{ width: `${(s.amount / grandTotal) * 100}%` }}
                  title={`${s.label}: ${s.amount.toLocaleString("ko-KR")}원`}
                />
              ))}
            </div>

            {/* 범례 */}
            <div className="space-y-2">
              {summary.map((s) => {
                const Icon = ROOM_ICONS[s.label] || Home;
                const pct = ((s.amount / grandTotal) * 100).toFixed(1);
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
                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 flex-1">{s.label}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                    <span className="text-xs font-medium text-gray-900">
                      {s.amount.toLocaleString("ko-KR")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 산출 기준 */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">산출 기준</p>
            <div className="space-y-1.5 text-[11px] text-gray-500">
              <p>• 단가: 2026년 물가정보 및 물가협회 기준</p>
              <p>• 노무비: 노임단가 표준품셈 적용</p>
              <p>• 경비: (재료비+노무비) × 10%</p>
              <p>• VAT 별도, 부대비용 별도</p>
              <p>• 실측 후 물량 변동 가능</p>
            </div>
            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-[11px] text-amber-700 font-medium">
                ※ 본 견적은 대략적인 참고 금액이며, 실제 시공 시 현장 상황에 따라 변동될 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 우측: 견적 테이블 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 공간 필터 탭 */}
          <div className="flex items-center gap-2 mb-4">
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
        </div>
      </div>
    </div>
  );
}
