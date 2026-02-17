"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Package,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useMaterialCatalogV2 } from "@/hooks/useMaterialCatalogV2";
import type { SelectedMaterial } from "@/types/consumer-project";
import type { ParsedFloorPlan, RoomData, RoomType } from "@/types/floorplan";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import type { MaterialCategory, MaterialProduct } from "@/lib/data/material-catalog-v2";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";

// 등급 배지 색상
const GRADE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  economy: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "경제형" },
  standard: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "표준형" },
  premium: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "프리미엄" },
};

export default function RenderingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateRendering, updateMaterial, updateStatus } =
    useProjectState(projectId);

  const {
    allCategories,
    categoriesForRoom,
    selectedProducts,
    toggleProduct,
    getSelectedProduct,
    selectedCount,
    totalCategories,
    totalMaterialCost,
    loadSelections,
  } = useMaterialCatalogV2();

  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [filterRoom, setFilterRoom] = useState<string | null>(null); // null = 전체
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // 프로젝트 저장된 자재 데이터에서 선택 복원
  useEffect(() => {
    if (!project?.rendering?.materials?.length) return;
    const selections: Record<string, string> = {};
    for (const mat of project.rendering.materials) {
      if (mat.categoryCode && mat.productId) {
        selections[mat.categoryCode] = mat.productId;
      }
    }
    if (Object.keys(selections).length > 0) {
      loadSelections(selections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI 디자인 이미지 (Tab 1에서 생성된 것)
  const designImages = project?.design?.generatedImages || [];

  // 방 클릭 → 필터
  const handleRoomClick = useCallback((room: RoomData) => {
    setSelectedRoom(room);
    setFilterRoom(room.type);
    setExpandedCategories({});
  }, []);

  // 카테고리 토글
  const handleToggleCategory = useCallback((code: string) => {
    setExpandedCategories((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  // 제품 선택/해제
  const handleProductSelect = useCallback(
    (category: MaterialCategory, product: MaterialProduct) => {
      toggleProduct(category.code, product.id);

      // SelectedMaterial로 변환하여 프로젝트 상태에도 반영
      const isCurrentlySelected = selectedProducts[category.code] === product.id;
      if (!isCurrentlySelected) {
        // 선택
        const mat: SelectedMaterial = {
          id: product.id,
          roomId: "",
          roomName: "",
          category: category.nameKr,
          categoryCode: category.code,
          part: category.nameKr,
          materialName: `${product.brand} ${product.productName}`,
          specification: product.spec,
          unitPrice: product.unitPrice,
          laborPrice: product.laborPrice,
          unit: product.unit,
          brand: product.brand,
          productId: product.id,
          priceGrade: product.priceGrade,
          priceSource: product.priceSource,
          subMaterials: product.subItems,
          confirmed: true,
        };
        updateMaterial(mat);
      }
    },
    [toggleProduct, selectedProducts, updateMaterial]
  );

  // 표시할 카테고리 (필터 적용)
  const displayCategories = useMemo(() => {
    if (!filterRoom) return allCategories;
    return categoriesForRoom(filterRoom);
  }, [filterRoom, allCategories, categoriesForRoom]);

  // 선택된 자재 요약 목록
  const selectedSummary = useMemo(() => {
    const items: { category: string; product: MaterialProduct; categoryCode: string }[] = [];
    for (const cat of allCategories) {
      const pid = selectedProducts[cat.code];
      if (pid) {
        const prod = cat.products.find((p) => p.id === pid);
        if (prod) items.push({ category: cat.nameKr, product: prod, categoryCode: cat.code });
      }
    }
    return items;
  }, [allCategories, selectedProducts]);

  // 프로젝트 저장
  const handleSaveAndNext = useCallback(() => {
    // 선택된 자재를 rendering.materials에 저장
    const materials: SelectedMaterial[] = selectedSummary.map((item) => ({
      id: item.product.id,
      roomId: "",
      roomName: "",
      category: item.category,
      categoryCode: item.categoryCode,
      part: item.category,
      materialName: `${item.product.brand} ${item.product.productName}`,
      specification: item.product.spec,
      unitPrice: item.product.unitPrice,
      laborPrice: item.product.laborPrice,
      unit: item.product.unit,
      brand: item.product.brand,
      productId: item.product.id,
      priceGrade: item.product.priceGrade,
      priceSource: item.product.priceSource,
      subMaterials: item.product.subItems,
      confirmed: true,
    }));

    updateRendering({
      views: project?.rendering?.views || [],
      materials,
      allConfirmed: selectedCount > 0,
    });

    updateStatus("ESTIMATING");
    router.push(`/project/${projectId}/estimate`);
  }, [selectedSummary, updateRendering, project?.rendering?.views, selectedCount, updateStatus, router, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl opacity-20 animate-pulse" />
            <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-500 animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-gray-500 font-medium">자재 카탈로그 로딩 중</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">자재 선택</h2>
          </div>
          {floorPlan && (
            <span className="hidden sm:inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full">
              {floorPlan.totalArea}m² · {floorPlan.rooms.length}개 공간
            </span>
          )}
          <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full items-center gap-1 ${
            selectedCount === totalCategories
              ? "bg-green-50 text-green-700"
              : "bg-blue-50 text-blue-700"
          }`}>
            <CheckCircle2 className="w-3 h-3" />
            {selectedCount}/{totalCategories} 선택
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSaveAndNext}
            className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            물량산출 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        {/* 좌측 패널 */}
        <div className="w-full md:w-[360px] md:min-w-[320px] flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* AI 디자인 참조 */}
          {designImages.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-700">AI 디자인 참조</span>
                  <span className="text-[10px] text-indigo-400 ml-1">이 디자인을 위한 자재를 선택하세요</span>
                </div>
              </div>
              <div className="flex gap-2 p-3 overflow-x-auto">
                {designImages.slice(0, 4).map((img) => (
                  <div key={img.id} className="flex-shrink-0 w-[120px]">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={img.imageData}
                        alt={img.roomName || "디자인"}
                        className="w-full aspect-[4/3] object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        <span className="text-[10px] text-white font-medium">
                          {img.roomName || "디자인"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 평면도 미니맵 */}
          {floorPlan && (
            <div className="border-b border-gray-200">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">공간 선택</span>
                {filterRoom && (
                  <button
                    onClick={() => { setFilterRoom(null); setSelectedRoom(null); }}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> 필터 해제
                  </button>
                )}
              </div>
              <FloorPlan2D
                floorPlan={floorPlan}
                onRoomClick={handleRoomClick}
                selectedRoomId={selectedRoom?.id}
                className="max-h-[140px] md:max-h-[160px] border-0 rounded-none"
              />
            </div>
          )}

          {/* 선택 요약 */}
          <div className="flex-1 overflow-y-auto hidden md:block">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-700">선택된 자재</span>
                <span className="text-xs text-gray-400">{selectedSummary.length}개</span>
              </div>
              {selectedSummary.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">우측에서 자재를 선택하세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSummary.map((item) => {
                    const grade = GRADE_STYLES[item.product.priceGrade];
                    return (
                      <div
                        key={item.categoryCode}
                        className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100"
                      >
                        {item.product.colorHex && (
                          <div
                            className="w-6 h-6 rounded border border-gray-200 flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: item.product.colorHex }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">{item.category}</span>
                            <span className={`px-1 py-0 text-[9px] font-medium rounded border ${grade.bg} ${grade.text}`}>
                              {grade.label}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {item.product.brand} {item.product.productName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {(item.product.unitPrice + item.product.laborPrice).toLocaleString()}원/{item.product.unit}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 총 자재비 */}
            {selectedSummary.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-blue-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">예상 단가 합계</span>
                  <span className="text-sm font-bold text-blue-800">
                    {totalMaterialCost.toLocaleString()}원
                  </span>
                </div>
                <p className="text-[10px] text-blue-500 mt-1">
                  * 실제 비용은 면적·수량 적용 후 물량산출에서 확인
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 카테고리 브라우저 */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-3 sm:p-4">
            {/* 필터 상태 표시 */}
            {filterRoom && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs text-blue-700">
                  <strong>{ROOM_TYPE_LABELS[filterRoom as RoomType] || filterRoom}</strong> 공간에 적용 가능한 자재만 표시 중
                </span>
              </div>
            )}

            {/* 카테고리 아코디언 */}
            <div className="space-y-2">
              {displayCategories.map((category) => {
                const isExpanded = expandedCategories[category.code] ?? false;
                const selectedProd = getSelectedProduct(category.code);
                const hasSelection = !!selectedProd;

                return (
                  <div
                    key={category.code}
                    className={`bg-white rounded-xl border overflow-hidden transition-all ${
                      hasSelection ? "border-blue-200 shadow-sm" : "border-gray-200"
                    }`}
                  >
                    {/* 카테고리 헤더 */}
                    <button
                      onClick={() => handleToggleCategory(category.code)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{category.nameKr}</span>
                            <span className="text-[10px] text-gray-400">{category.products.length}개 제품</span>
                          </div>
                          {selectedProd && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              {selectedProd.brand} {selectedProd.productName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasSelection ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
                            <Check className="w-3 h-3" /> 선택됨
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-medium rounded-full">
                            미선택
                          </span>
                        )}
                      </div>
                    </button>

                    {/* 제품 카드 그리드 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {category.products.map((product) => {
                            const isSelected = selectedProducts[category.code] === product.id;
                            const grade = GRADE_STYLES[product.priceGrade];

                            return (
                              <button
                                key={product.id}
                                onClick={() => handleProductSelect(category, product)}
                                className={`text-left p-3 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-50/50 shadow-sm"
                                    : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                {/* 컬러 스와치 + 등급 */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {product.colorHex ? (
                                      <div
                                        className="w-8 h-8 rounded-lg border border-gray-200"
                                        style={{ backgroundColor: product.colorHex }}
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200" />
                                    )}
                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${grade.bg} ${grade.text}`}>
                                      {grade.label}
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>

                                {/* 브랜드 + 제품명 */}
                                <p className="text-[10px] text-gray-400 mb-0.5">{product.brand}</p>
                                <p className={`text-xs font-medium mb-1 ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                                  {product.productName}
                                </p>

                                {/* 규격 */}
                                <p className="text-[10px] text-gray-400 mb-2 line-clamp-1">{product.spec}</p>

                                {/* 가격 */}
                                <div className="flex items-baseline justify-between">
                                  <div>
                                    <span className="text-sm font-bold text-gray-900">
                                      {product.unitPrice.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400">원/{product.unit}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">
                                    +시공 {product.laborPrice.toLocaleString()}
                                  </span>
                                </div>

                                {/* 태그 */}
                                {product.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {product.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="px-1.5 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* 부자재 (선택 시 표시) */}
                                {isSelected && product.subItems.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-blue-200">
                                    <p className="text-[10px] text-blue-500 font-medium mb-1">포함 부자재:</p>
                                    {product.subItems.map((sub) => (
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 하단 고정 바 */}
      <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-30">
        <button
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="flex items-center gap-2"
        >
          <span className="text-xs text-gray-500">
            {selectedCount}/{totalCategories} 선택
          </span>
          {totalMaterialCost > 0 && (
            <span className="text-sm font-bold text-gray-900">
              {totalMaterialCost.toLocaleString()}원
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMobileSummary ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={handleSaveAndNext}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          물량산출 <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 모바일 선택 요약 시트 */}
      {showMobileSummary && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowMobileSummary(false)}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-bold text-gray-900">선택된 자재</span>
              <button onClick={() => setShowMobileSummary(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedSummary.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">선택된 자재가 없습니다</p>
              ) : (
                selectedSummary.map((item) => {
                  const grade = GRADE_STYLES[item.product.priceGrade];
                  return (
                    <div
                      key={item.categoryCode}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50"
                    >
                      {item.product.colorHex && (
                        <div
                          className="w-6 h-6 rounded border border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: item.product.colorHex }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">{item.category}</span>
                          <span className={`px-1 py-0 text-[9px] font-medium rounded border ${grade.bg} ${grade.text}`}>
                            {grade.label}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {item.product.brand} {item.product.productName}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-600 flex-shrink-0">
                        {(item.product.unitPrice + item.product.laborPrice).toLocaleString()}원
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            {totalMaterialCost > 0 && (
              <div className="p-4 border-t border-gray-200 bg-blue-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">예상 단가 합계</span>
                  <span className="text-sm font-bold text-blue-800">
                    {totalMaterialCost.toLocaleString()}원
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
