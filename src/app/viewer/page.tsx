"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Palette, Maximize2, Box, Layout, Loader2, ArrowRight, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { generateFloorPlan } from "@/lib/floorplan-generator";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";
import type { RoomData, MaterialSelection } from "@/types/floorplan";
import { ROOM_TYPE_LABELS, ROOM_TYPE_COLORS } from "@/types/floorplan";

const Model3DViewer = dynamic(() => import("@/components/viewer/Model3DViewer"), { ssr: false });

const WALL_MATERIALS = [
  { id: "wall-white", label: "화이트", color: "#FFFFFF" },
  { id: "wall-ivory", label: "아이보리", color: "#F5F0EB" },
  { id: "wall-beige", label: "베이지", color: "#E8DCC8" },
  { id: "wall-gray", label: "그레이", color: "#D4D4D4" },
  { id: "wall-mint", label: "민트", color: "#D1E8E0" },
  { id: "wall-bluegray", label: "블루그레이", color: "#C8D1DC" },
];

const FLOOR_MATERIALS = [
  { id: "floor-oak", label: "오크", color: "#C4A882" },
  { id: "floor-walnut", label: "월넛", color: "#8B6F4E" },
  { id: "floor-maple", label: "메이플", color: "#DEC89C" },
  { id: "floor-graytile", label: "그레이타일", color: "#B0B0B0" },
  { id: "floor-whitetile", label: "화이트타일", color: "#E8E8E8" },
  { id: "floor-marble", label: "마블", color: "#D4CFC8" },
];

const CEILING_MATERIALS = [
  { id: "ceil-white", label: "화이트", color: "#FFFFFF" },
  { id: "ceil-ivory", label: "아이보리", color: "#FAFAF5" },
  { id: "ceil-warm", label: "웜화이트", color: "#FFF8F0" },
];

function ViewerContent() {
  const searchParams = useSearchParams();
  const area = parseFloat(searchParams.get("area") || "84.9");
  const rooms = parseInt(searchParams.get("rooms") || "3", 10);
  const baths = parseInt(searchParams.get("baths") || "2", 10);
  const buildingType = searchParams.get("type") || "아파트";
  const address = searchParams.get("address") || "";
  const dong = searchParams.get("dong") || "";
  const ho = searchParams.get("ho") || "";

  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [materials, setMaterials] = useState<Record<string, MaterialSelection>>({});
  const [materialTarget, setMaterialTarget] = useState<"all" | "selected">("all");

  const floorPlan = useMemo(() => generateFloorPlan({
    exclusiveArea: area,
    roomCount: rooms,
    bathroomCount: baths,
    buildingType,
  }), [area, rooms, baths, buildingType]);

  const selectedRoom = floorPlan.rooms.find((r) => r.id === selectedRoomId);

  const handleRoomClick = useCallback((room: RoomData) => {
    setSelectedRoomId((prev) => room.id === prev ? undefined : room.id);
  }, []);

  const handle3DAreaClick = useCallback((areaId: string) => {
    setSelectedRoomId((prev) => areaId === prev ? undefined : areaId);
  }, []);

  const applyMaterial = useCallback((areaType: 'wall' | 'floor' | 'ceiling', materialId: string, materialName: string, color: string) => {
    setMaterials((prev) => {
      const next = { ...prev };
      if (materialTarget === "all" || !selectedRoomId) {
        // Apply to all rooms
        floorPlan.rooms.forEach((room) => {
          const key = `${room.id}-${areaType}`;
          next[key] = { roomId: room.id, areaType, materialId, materialName, color };
        });
        // Also set global default
        next[`__global-${areaType}`] = { roomId: "__global", areaType, materialId, materialName, color };
      } else {
        // Apply to selected room only
        const key = `${selectedRoomId}-${areaType}`;
        next[key] = { roomId: selectedRoomId, areaType, materialId, materialName, color };
      }
      return next;
    });
  }, [materialTarget, selectedRoomId, floorPlan.rooms]);

  const resetMaterials = useCallback(() => {
    setMaterials({});
  }, []);

  // Get current material for display
  const getCurrentMaterial = useCallback((areaType: 'wall' | 'floor' | 'ceiling') => {
    if (selectedRoomId && materialTarget === "selected") {
      const key = `${selectedRoomId}-${areaType}`;
      return materials[key]?.materialId;
    }
    return materials[`__global-${areaType}`]?.materialId;
  }, [materials, selectedRoomId, materialTarget]);

  // Count rooms with custom materials
  const customMaterialCount = useMemo(() => {
    const roomIds = new Set(Object.values(materials).filter((m) => m.roomId !== "__global").map((m) => m.roomId));
    return roomIds.size;
  }, [materials]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/consult" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
          <span className="text-sm text-gray-500">도면 뷰어</span>
        </div>
        <div className="flex items-center gap-2">
          {address && (
            <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {dong} {ho} | {area}m²
            </span>
          )}

          {/* 2D/3D Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode("2d")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                viewMode === "2d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              <Layout className="w-3.5 h-3.5" /> 2D
            </button>
            <button onClick={() => setViewMode("3d")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                viewMode === "3d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}>
              <Box className="w-3.5 h-3.5" /> 3D
            </button>
          </div>

          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Viewer */}
        <div className={`flex-1 relative ${isFullscreen ? "w-full" : ""}`}>
          {viewMode === "2d" ? (
            <div className="w-full h-full p-4">
              <FloorPlan2D
                floorPlan={floorPlan}
                selectedRoomId={selectedRoomId}
                onRoomClick={handleRoomClick}
                className="w-full h-full"
              />
            </div>
          ) : (
            <Model3DViewer
              floorPlan={floorPlan}
              selectedArea={selectedRoomId}
              onAreaClick={handle3DAreaClick}
              materials={materials}
              className="w-full h-full"
            />
          )}

          <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            {viewMode === "2d" ? "클릭: 공간 선택" : "클릭: 공간 선택 | 드래그: 회전 | 스크롤: 줌"}
          </div>
        </div>

        {/* Controls Panel */}
        {!isFullscreen && (
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-5">

              {/* Selected Room Info */}
              {selectedRoom && (
                <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-blue-900">{selectedRoom.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ROOM_TYPE_COLORS[selectedRoom.type], color: "#374151" }}>
                      {ROOM_TYPE_LABELS[selectedRoom.type]}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">{selectedRoom.area}m² ({(selectedRoom.area * 0.3025).toFixed(1)}평)</p>
                  <p className="text-xs text-blue-500 mt-1">{selectedRoom.position.width.toFixed(1)}m x {selectedRoom.position.height.toFixed(1)}m</p>
                </div>
              )}

              {/* Room List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">공간 목록</h3>
                <div className="space-y-1.5">
                  {floorPlan.rooms.map((room) => {
                    const hasCustom = Object.values(materials).some((m) => m.roomId === room.id);
                    return (
                      <button key={room.id} onClick={() => handleRoomClick(room)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          room.id === selectedRoomId ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "hover:bg-gray-50 text-gray-700"
                        }`}>
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: ROOM_TYPE_COLORS[room.type] }} />
                        <span className="flex-1 text-left font-medium">{room.name}</span>
                        {hasCustom && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        <span className="text-xs text-gray-400">{room.area}m²</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Material Controls (3D mode) */}
              {viewMode === "3d" && (
                <>
                  {/* Apply Target Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Palette className="w-4 h-4" /> 마감재 설정
                      </h3>
                      <button onClick={resetMaterials} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> 초기화
                      </button>
                    </div>
                    <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
                      <button onClick={() => setMaterialTarget("all")}
                        className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          materialTarget === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                        }`}>
                        전체 적용
                      </button>
                      <button onClick={() => setMaterialTarget("selected")}
                        className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          materialTarget === "selected" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                        }`}>
                        {selectedRoom ? selectedRoom.name : "공간 선택"}
                      </button>
                    </div>
                    {materialTarget === "selected" && !selectedRoomId && (
                      <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-md mb-3">
                        3D 뷰에서 공간을 클릭해 선택하세요
                      </p>
                    )}
                    {customMaterialCount > 0 && (
                      <p className="text-xs text-gray-400 mb-3">
                        {customMaterialCount}개 공간에 마감재 적용됨
                      </p>
                    )}
                  </div>

                  {/* Wall Materials */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">벽면</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {WALL_MATERIALS.map((m) => (
                        <button key={m.id} onClick={() => applyMaterial("wall", m.id, m.label, m.color)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                            getCurrentMaterial("wall") === m.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}>
                          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: m.color }} />
                          <span className="text-xs text-gray-600">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Floor Materials */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">바닥</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {FLOOR_MATERIALS.map((m) => (
                        <button key={m.id} onClick={() => applyMaterial("floor", m.id, m.label, m.color)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                            getCurrentMaterial("floor") === m.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}>
                          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: m.color }} />
                          <span className="text-xs text-gray-600">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ceiling Materials */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">천장</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {CEILING_MATERIALS.map((m) => (
                        <button key={m.id} onClick={() => applyMaterial("ceiling", m.id, m.label, m.color)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                            getCurrentMaterial("ceiling") === m.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}>
                          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: m.color }} />
                          <span className="text-xs text-gray-600">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Floor Plan Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">도면 정보</h3>
                <div className="space-y-1.5 text-sm text-gray-600">
                  <p>총 면적: {floorPlan.totalArea}m² ({(floorPlan.totalArea * 0.3025).toFixed(1)}평)</p>
                  <p>공간: {floorPlan.rooms.length}개</p>
                  <p>벽체: {floorPlan.walls.length}개 (외벽 {floorPlan.walls.filter((w) => w.isExterior).length})</p>
                  <p>문: {floorPlan.doors.length}개 | 창: {floorPlan.windows.length}개</p>
                </div>
              </div>

              <Link href="/consult"
                className="block w-full text-center bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <span className="inline-flex items-center gap-1">AI 상담으로 견적 받기 <ArrowRight className="w-4 h-4" /></span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
