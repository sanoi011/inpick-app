"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Maximize2,
  RefreshCw,
  Coins,
  ChevronDown,
  ChevronUp,
  Palette,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useCredits } from "@/hooks/useCredits";
import type { RenderView, SelectedMaterial, SubMaterial } from "@/types/consumer-project";
import type { ParsedFloorPlan, RoomData } from "@/types/floorplan";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";

// Mock 자재 카테고리별 데이터
const MATERIAL_CATALOG: Record<string, { category: string; part: string; options: { name: string; spec: string; price: number; unit: string; subMaterials: SubMaterial[] }[] }[]> = {
  LIVING: [
    {
      category: "바닥", part: "거실 바닥",
      options: [
        { name: "강화마루", spec: "12mm 오크", price: 35000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "레벨링", unitPrice: 8000, unit: "m²" }, { name: "걸레받이", specification: "PVC 60mm", unitPrice: 3000, unit: "m" }] },
        { name: "원목마루", spec: "15mm 월넛", price: 85000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "합판깔기", unitPrice: 15000, unit: "m²" }, { name: "걸레받이", specification: "원목 80mm", unitPrice: 8000, unit: "m" }] },
        { name: "타일", spec: "600x600 포세린", price: 45000, unit: "m²", subMaterials: [{ name: "타일 시멘트", specification: "접착제", unitPrice: 5000, unit: "m²" }, { name: "줄눈재", specification: "2mm", unitPrice: 2000, unit: "m²" }] },
      ],
    },
    {
      category: "벽", part: "거실 벽면",
      options: [
        { name: "실크 벽지", spec: "LG하우시스 친환경", price: 12000, unit: "m²", subMaterials: [{ name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" }] },
        { name: "포인트 벽지", spec: "수입 패턴 벽지", price: 25000, unit: "m²", subMaterials: [{ name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" }] },
        { name: "페인트", spec: "벤자민무어 매트", price: 18000, unit: "m²", subMaterials: [{ name: "퍼티 작업", specification: "2회", unitPrice: 5000, unit: "m²" }] },
      ],
    },
    {
      category: "천장", part: "거실 천장",
      options: [
        { name: "도장", spec: "KCC 수성페인트", price: 8000, unit: "m²", subMaterials: [] },
        { name: "우물천장", spec: "석고보드 + 몰딩", price: 35000, unit: "m²", subMaterials: [{ name: "석고보드", specification: "9.5mm", unitPrice: 5000, unit: "m²" }, { name: "크라운 몰딩", specification: "PU 120mm", unitPrice: 12000, unit: "m" }] },
      ],
    },
  ],
  BED: [
    {
      category: "바닥", part: "침실 바닥",
      options: [
        { name: "강화마루", spec: "12mm 오크", price: 35000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "레벨링", unitPrice: 8000, unit: "m²" }] },
        { name: "원목마루", spec: "15mm 애쉬", price: 75000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "합판깔기", unitPrice: 15000, unit: "m²" }] },
      ],
    },
    {
      category: "벽", part: "침실 벽면",
      options: [
        { name: "실크 벽지", spec: "친환경 무지", price: 12000, unit: "m²", subMaterials: [] },
        { name: "포인트 벽지", spec: "그레이 패턴", price: 20000, unit: "m²", subMaterials: [] },
      ],
    },
  ],
  KITCHEN: [
    {
      category: "바닥", part: "주방 바닥",
      options: [
        { name: "타일", spec: "300x300 논슬립", price: 40000, unit: "m²", subMaterials: [{ name: "타일 접착제", specification: "방수형", unitPrice: 6000, unit: "m²" }] },
        { name: "강화마루", spec: "12mm 방수", price: 45000, unit: "m²", subMaterials: [] },
      ],
    },
    {
      category: "벽", part: "주방 벽면/백스플래시",
      options: [
        { name: "서브웨이 타일", spec: "75x150 화이트", price: 35000, unit: "m²", subMaterials: [{ name: "타일 접착제", specification: "일반", unitPrice: 5000, unit: "m²" }] },
        { name: "강화유리", spec: "5mm 투명", price: 55000, unit: "m²", subMaterials: [{ name: "실리콘", specification: "방수형", unitPrice: 2000, unit: "m" }] },
      ],
    },
  ],
  BATHROOM: [
    {
      category: "바닥", part: "욕실 바닥",
      options: [
        { name: "타일", spec: "200x200 논슬립", price: 45000, unit: "m²", subMaterials: [{ name: "방수 시공", specification: "우레탄 2중", unitPrice: 25000, unit: "m²" }] },
        { name: "대리석", spec: "300x300 백마블", price: 80000, unit: "m²", subMaterials: [{ name: "방수 시공", specification: "우레탄 2중", unitPrice: 25000, unit: "m²" }] },
      ],
    },
    {
      category: "벽", part: "욕실 벽면",
      options: [
        { name: "타일", spec: "300x600 유광", price: 40000, unit: "m²", subMaterials: [{ name: "방수 시공", specification: "벽면 방수", unitPrice: 15000, unit: "m²" }] },
        { name: "대리석", spec: "600x300 그레이", price: 90000, unit: "m²", subMaterials: [{ name: "방수 시공", specification: "벽면 방수", unitPrice: 15000, unit: "m²" }] },
      ],
    },
  ],
};

// 기본 자재 카탈로그 (매칭 안 되는 방은 이걸로)
const DEFAULT_MATERIALS = MATERIAL_CATALOG["LIVING"];

function getMaterialsForRoom(roomType: string) {
  return MATERIAL_CATALOG[roomType] || MATERIAL_CATALOG[roomType.replace("MASTER_", "")] || DEFAULT_MATERIALS;
}

export default function RenderingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const {
    project,
    updateRendering,
    addRenderView,
    updateMaterial,
    updateStatus,
  } = useProjectState(projectId);
  const { credits, canGenerate, spendCredits } = useCredits();

  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [renderViews, setRenderViews] = useState<RenderView[]>([]);
  const [materials, setMaterials] = useState<SelectedMaterial[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderingRoomId, setRenderingRoomId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showMaterialPanel, setShowMaterialPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    if (project?.rendering?.views) setRenderViews(project.rendering.views);
    if (project?.rendering?.materials) setMaterials(project.rendering.materials);
    if (project?.drawingId) {
      loadFloorPlan(project.drawingId).then((plan) => {
        if (plan) {
          setFloorPlan(plan);
          // 첫 번째 방 자동 선택
          if (plan.rooms.length > 0 && !selectedRoom) {
            setSelectedRoom(plan.rooms[0]);
          }
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.drawingId, project?.rendering?.views, project?.rendering?.materials]);

  // 방 선택
  const handleRoomClick = (room: RoomData) => {
    setSelectedRoom(room);
    setExpandedCategories({});
  };

  // 렌더링 생성 (개별 방)
  const handleRenderRoom = useCallback(async (room: RoomData) => {
    if (isRendering) return;

    if (!canGenerate()) return;

    setIsRendering(true);
    setRenderingRoomId(room.id);

    try {
      await spendCredits();

      const roomLabel = ROOM_TYPE_LABELS[room.type] || room.name;
      const roomMaterials = materials.filter((m) => m.roomId === room.id);
      const materialContext = roomMaterials.length > 0
        ? roomMaterials.map((m) => `${m.part}: ${m.materialName} (${m.specification})`).join(", ")
        : "";

      const designImages = project?.design?.generatedImages || [];
      const roomDesign = designImages.find((img) => img.roomId === room.id);

      const prompt = `포토리얼리스틱 인테리어 렌더링: ${roomLabel} ${room.area}m². ${
        roomDesign ? `디자인 컨셉: ${roomDesign.prompt}.` : ""
      } ${materialContext ? `자재: ${materialContext}.` : ""} 고화질 실사급 3D 렌더링.`;

      const res = await fetch("/api/project/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          roomContext: `${roomLabel} ${room.area}m²`,
          floorPlanContext: floorPlan
            ? floorPlan.rooms.map((r) => `${r.name}(${r.area}m²)`).join(", ")
            : "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newView: RenderView = {
          id: crypto.randomUUID(),
          roomId: room.id,
          roomName: roomLabel,
          imageData: data.imageData,
          prompt,
          confirmed: false,
          createdAt: new Date().toISOString(),
        };

        setRenderViews((prev) => {
          // 같은 방 이전 렌더 교체
          const filtered = prev.filter((v) => v.roomId !== room.id);
          return [...filtered, newView];
        });
        addRenderView(newView);
      }
    } catch {
      // 에러 무시
    }

    setIsRendering(false);
    setRenderingRoomId(null);
  }, [isRendering, canGenerate, spendCredits, materials, project?.design?.generatedImages, floorPlan, addRenderView]);

  // 전체 방 렌더링
  const handleRenderAll = useCallback(async () => {
    if (!floorPlan || isRendering) return;
    for (const room of floorPlan.rooms) {
      await handleRenderRoom(room);
    }
  }, [floorPlan, isRendering, handleRenderRoom]);

  // 렌더링 확인 토글
  const handleConfirmView = (viewId: string) => {
    setRenderViews((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, confirmed: !v.confirmed } : v))
    );
    const view = renderViews.find((v) => v.id === viewId);
    if (view) {
      const updatedViews = renderViews.map((v) =>
        v.id === viewId ? { ...v, confirmed: !v.confirmed } : v
      );
      const allConfirmed = updatedViews.length > 0 && updatedViews.every((v) => v.confirmed);
      updateRendering({ views: updatedViews, allConfirmed });
    }
  };

  // 자재 변경
  const handleMaterialChange = (
    roomId: string,
    roomName: string,
    category: string,
    part: string,
    option: { name: string; spec: string; price: number; unit: string; subMaterials: SubMaterial[] }
  ) => {
    const existingIdx = materials.findIndex((m) => m.roomId === roomId && m.category === category);
    const newMaterial: SelectedMaterial = {
      id: existingIdx >= 0 ? materials[existingIdx].id : crypto.randomUUID(),
      roomId,
      roomName,
      category,
      part,
      materialName: option.name,
      specification: option.spec,
      unitPrice: option.price,
      unit: option.unit,
      subMaterials: option.subMaterials,
      confirmed: false,
    };

    if (existingIdx >= 0) {
      setMaterials((prev) => prev.map((m, i) => (i === existingIdx ? newMaterial : m)));
    } else {
      setMaterials((prev) => [...prev, newMaterial]);
    }
    updateMaterial(newMaterial);
  };

  // 카테고리 접기/펼치기
  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 다음 단계
  const handleNext = () => {
    updateStatus("ESTIMATING");
    router.push(`/project/${projectId}/estimate`);
  };

  // 모든 렌더링 확인됐는지 체크
  const allConfirmed = renderViews.length > 0 && renderViews.every((v) => v.confirmed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">3D 렌더링</h2>
          {allConfirmed && (
            <span className="hidden sm:flex px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 모든 공간 확인 완료
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 크레딧 */}
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200">
            <Coins className="w-3 h-3" />
            {credits ? `${credits.balance} 크레딧` : "로그인 필요"}
          </span>

          {floorPlan && renderViews.length === 0 && (
            <button
              onClick={handleRenderAll}
              disabled={isRendering}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              전체 렌더링
            </button>
          )}

          {allConfirmed && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              물량산출 <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 평면도 + 렌더링 갤러리 */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
          {/* 평면도 미니맵 */}
          {floorPlan && (
            <div className="border-b border-gray-200 bg-white">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-600">
                  공간 선택 (클릭하여 렌더링/자재 수정)
                </span>
              </div>
              <FloorPlan2D
                floorPlan={floorPlan}
                onRoomClick={handleRoomClick}
                selectedRoomId={selectedRoom?.id}
                className="max-h-[160px] border-0 rounded-none"
              />
            </div>
          )}

          {/* 렌더링 갤러리 */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderViews.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">렌더링 이미지가 없습니다</p>
                  <p className="text-xs mt-1 mb-4">상단의 &quot;전체 렌더링&quot; 버튼을 클릭하거나<br />오른쪽 패널에서 개별 공간을 렌더링하세요</p>
                  {floorPlan && (
                    <button
                      onClick={handleRenderAll}
                      disabled={isRendering}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      전체 렌더링 시작
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderViews.map((view) => (
                  <div
                    key={view.id}
                    className={`relative group bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${
                      view.confirmed ? "border-green-300" : "border-gray-200"
                    } ${selectedRoom?.id === view.roomId ? "ring-2 ring-blue-400" : ""}`}
                  >
                    {/* 이미지 */}
                    <div className="relative">
                      <img
                        src={view.imageData}
                        alt={view.roomName}
                        className="w-full aspect-[4/3] object-cover cursor-pointer"
                        onClick={() => setExpandedImage(view.id)}
                      />
                      {/* 오버레이 버튼 */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setExpandedImage(view.id)}
                          className="p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleRenderRoom(floorPlan!.rooms.find((r) => r.id === view.roomId)!)}
                          className="p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white"
                          title="재렌더링"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                      {/* 확인 뱃지 */}
                      {view.confirmed && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> 확인됨
                        </div>
                      )}
                      {/* 렌더링 중 오버레이 */}
                      {isRendering && renderingRoomId === view.roomId && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    {/* 정보 + 확인 버튼 */}
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{view.roomName}</p>
                        <p className="text-xs text-gray-400">
                          {materials.filter((m) => m.roomId === view.roomId).length}개 자재 선택됨
                        </p>
                      </div>
                      <button
                        onClick={() => handleConfirmView(view.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          view.confirmed
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {view.confirmed ? "확인됨" : "확인"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 모바일 자재 패널 버튼 */}
        {selectedRoom && (
          <button
            onClick={() => setShowMaterialPanel(true)}
            className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <Palette className="w-4 h-4" />
            자재 선택
          </button>
        )}

        {/* 모바일 자재 오버레이 배경 */}
        {showMaterialPanel && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowMaterialPanel(false)}
          />
        )}

        {/* 우측: 자재 수정 패널 */}
        <div className={`
          fixed inset-0 z-50 md:static md:z-auto
          w-full md:w-[340px] md:min-w-[300px] flex-shrink-0 border-l border-gray-200 flex-col bg-white overflow-hidden
          ${showMaterialPanel ? "flex" : "hidden md:flex"}
        `}>
          {/* 모바일 닫기 헤더 */}
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-900">자재 선택</span>
            <button onClick={() => setShowMaterialPanel(false)}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          {selectedRoom ? (
            <>
              {/* 방 정보 헤더 */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {ROOM_TYPE_LABELS[selectedRoom.type] || selectedRoom.name}
                    </h3>
                    <p className="text-xs text-gray-500">{selectedRoom.area}m²</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRenderRoom(selectedRoom)}
                      disabled={isRendering}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {isRendering && renderingRoomId === selectedRoom.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                      렌더링
                    </button>
                  </div>
                </div>
              </div>

              {/* 자재 목록 */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Palette className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-gray-700">자재 선택</span>
                  </div>

                  {getMaterialsForRoom(selectedRoom.type).map((matGroup) => {
                    const key = `${selectedRoom.id}-${matGroup.category}`;
                    const isExpanded = expandedCategories[key] !== false; // 기본 펼침
                    const currentMat = materials.find(
                      (m) => m.roomId === selectedRoom.id && m.category === matGroup.category
                    );

                    return (
                      <div key={key} className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
                        {/* 카테고리 헤더 */}
                        <button
                          onClick={() => toggleCategory(key)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700">{matGroup.category}</span>
                            <span className="text-[10px] text-gray-400">{matGroup.part}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {currentMat && (
                              <span className="text-[10px] text-blue-600 font-medium">
                                {currentMat.materialName}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* 자재 옵션 */}
                        {isExpanded && (
                          <div className="p-2 space-y-1.5">
                            {matGroup.options.map((option) => {
                              const isSelected = currentMat?.materialName === option.name;
                              return (
                                <button
                                  key={option.name}
                                  onClick={() =>
                                    handleMaterialChange(
                                      selectedRoom.id,
                                      ROOM_TYPE_LABELS[selectedRoom.type] || selectedRoom.name,
                                      matGroup.category,
                                      matGroup.part,
                                      option
                                    )
                                  }
                                  className={`w-full text-left p-2 rounded-lg border transition-colors ${
                                    isSelected
                                      ? "border-blue-400 bg-blue-50"
                                      : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                                      {option.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {option.price.toLocaleString()}원/{option.unit}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{option.spec}</p>

                                  {/* 부자재 표시 (선택 시) */}
                                  {isSelected && option.subMaterials.length > 0 && (
                                    <div className="mt-1.5 pt-1.5 border-t border-blue-200">
                                      <p className="text-[10px] text-blue-500 font-medium mb-1">연동 부자재:</p>
                                      {option.subMaterials.map((sub) => (
                                        <div key={sub.name} className="flex items-center justify-between">
                                          <span className="text-[10px] text-gray-500">
                                            {sub.name} ({sub.specification})
                                          </span>
                                          <span className="text-[10px] text-gray-400">
                                            {sub.unitPrice.toLocaleString()}원/{sub.unit}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 선택된 자재 요약 */}
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    선택된 자재: <strong className="text-gray-900">{materials.filter((m) => m.roomId === selectedRoom.id).length}개</strong>
                  </span>
                  {renderViews.find((v) => v.roomId === selectedRoom.id) && (
                    <button
                      onClick={() => handleRenderRoom(selectedRoom)}
                      disabled={isRendering}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <RefreshCw className="w-3 h-3" /> 자재 반영 재렌더링
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center text-gray-400">
                <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">평면도에서 공간을 선택하면<br />자재를 수정할 수 있습니다</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 이미지 확대 모달 */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={renderViews.find((v) => v.id === expandedImage)?.imageData}
              alt="확대 보기"
              className="w-full rounded-xl"
            />
            <div className="text-white text-sm mt-3 text-center">
              <p className="font-medium">{renderViews.find((v) => v.id === expandedImage)?.roomName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
