"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Package,
  Check,
  X,
  ImageIcon,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useMaterialCatalogV2 } from "@/hooks/useMaterialCatalogV2";
import type { SelectedMaterial } from "@/types/consumer-project";
import type { ParsedFloorPlan } from "@/types/floorplan";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import type { MaterialCategory, MaterialProduct } from "@/lib/data/material-catalog-v2";

// 등급 스타일
const GRADE = {
  economy: { label: "경제형", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  standard: { label: "표준형", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  premium: { label: "프리미엄", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};

// 공종 그룹
const GROUPS = [
  { id: "finish", label: "기본 마감", codes: ["FLOORING", "WALLPAPER", "PAINT", "CEILING", "BASEBOARD"] },
  { id: "door", label: "문/창호", codes: ["DOOR_ROOM", "SLIDING_PARTITION", "ENTRY_DOOR", "WINDOW"] },
  { id: "light", label: "조명", codes: ["LIGHTING"] },
  { id: "bath", label: "욕실", codes: ["TOILET", "VANITY", "SHOWER_BATH", "BATH_FAUCET", "BATH_TILE"] },
  { id: "kitchen", label: "주방", codes: ["KITCHEN_SINK", "KITCHEN_CABINET", "KITCHEN_FAUCET", "KITCHEN_TILE"] },
];

export default function RenderingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateRendering, updateMaterial, updateStatus } =
    useProjectState(projectId);

  const {
    allCategories,
    selectedProducts,
    toggleProduct,
    selectedCount,
    totalCategories,
    totalMaterialCost,
    loadSelections,
  } = useMaterialCatalogV2();

  const [floorPlan, setFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [activeGroup, setActiveGroup] = useState("finish");
  const [showConfirm, setShowConfirm] = useState(false);
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

  // 저장된 선택 복원
  useEffect(() => {
    if (!project?.rendering?.materials?.length) return;
    const sel: Record<string, string> = {};
    for (const m of project.rendering.materials) {
      if (m.categoryCode && m.productId) sel[m.categoryCode] = m.productId;
    }
    if (Object.keys(sel).length > 0) loadSelections(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 제품 선택
  const handleSelect = useCallback(
    (cat: MaterialCategory, prod: MaterialProduct) => {
      toggleProduct(cat.code, prod.id);
      const isSelected = selectedProducts[cat.code] === prod.id;
      if (!isSelected) {
        updateMaterial({
          id: prod.id, roomId: "", roomName: "",
          category: cat.nameKr, categoryCode: cat.code, part: cat.nameKr,
          materialName: `${prod.brand} ${prod.productName}`,
          specification: prod.spec,
          unitPrice: prod.unitPrice, laborPrice: prod.laborPrice, unit: prod.unit,
          brand: prod.brand, productId: prod.id,
          priceGrade: prod.priceGrade, priceSource: prod.priceSource,
          subMaterials: prod.subItems, confirmed: true,
        });
      }
    },
    [toggleProduct, selectedProducts, updateMaterial]
  );

  // 현재 그룹 카테고리
  const groupCategories = useMemo(() => {
    const g = GROUPS.find((g) => g.id === activeGroup);
    if (!g) return [];
    return allCategories.filter((c) => g.codes.includes(c.code));
  }, [activeGroup, allCategories]);

  // 그룹별 진행률
  const groupProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const g of GROUPS) {
      const cats = allCategories.filter((c) => g.codes.includes(c.code));
      map[g.id] = { total: cats.length, done: cats.filter((c) => selectedProducts[c.code]).length };
    }
    return map;
  }, [allCategories, selectedProducts]);

  // 선택 요약
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

  // 컨펌 → 물량산출
  const handleConfirm = useCallback(() => {
    const materials: SelectedMaterial[] = selectedSummary.map((item) => ({
      id: item.product.id, roomId: "", roomName: "",
      category: item.category, categoryCode: item.categoryCode, part: item.category,
      materialName: `${item.product.brand} ${item.product.productName}`,
      specification: item.product.spec,
      unitPrice: item.product.unitPrice, laborPrice: item.product.laborPrice,
      unit: item.product.unit, brand: item.product.brand, productId: item.product.id,
      priceGrade: item.product.priceGrade, priceSource: item.product.priceSource,
      subMaterials: item.product.subItems, confirmed: true,
    }));
    updateRendering({ views: project?.rendering?.views || [], materials, allConfirmed: true });
    updateStatus("ESTIMATING");
    router.push(`/project/${projectId}/estimate`);
  }, [selectedSummary, updateRendering, project?.rendering?.views, updateStatus, router, projectId]);

  // 등급순 정렬
  const sorted = (prods: MaterialProduct[]) => {
    const o = { economy: 0, standard: 1, premium: 2 };
    return [...prods].sort((a, b) => o[a.priceGrade] - o[b.priceGrade]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <div className="text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-blue-400 animate-pulse" />
          <p className="text-sm text-gray-500">자재 추천 로딩 중</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 상단 바 */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">자재 선택</h2>
            {floorPlan && (
              <span className="hidden sm:inline text-[11px] text-gray-400">
                {floorPlan.totalArea}m²
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 진행률 */}
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(selectedCount / totalCategories) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-gray-500">{selectedCount}/{totalCategories}</span>
            </div>
            {selectedCount > 0 && (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                확인 <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 공종 탭 바 */}
        <div className="flex items-center gap-0.5 px-4 pb-0 overflow-x-auto scrollbar-hide">
          {GROUPS.map((g) => {
            const p = groupProgress[g.id];
            const isActive = activeGroup === g.id;
            const isDone = p && p.done === p.total;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                {g.label}
                {p && !isDone && (
                  <span className="text-[10px] text-gray-400">{p.done}/{p.total}</span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 메인 컨텐츠 - 스크롤 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-10">
          {groupCategories.map((category) => {
            const products = sorted(category.products);
            const selectedId = selectedProducts[category.code];

            return (
              <section key={category.code} id={`cat-${category.code}`}>
                {/* 부위 타이틀 */}
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-base font-bold text-gray-900">{category.nameKr}</h3>
                  {selectedId && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>

                {/* 3개 추천 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {products.map((product) => {
                    const isSelected = selectedId === product.id;
                    const grade = GRADE[product.priceGrade];

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleSelect(category, product)}
                        className={`group relative text-left rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-white shadow-md"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                        }`}
                      >
                        {/* 이미지 영역 (추후 크롤링 이미지 삽입용) */}
                        <div className={`relative w-full aspect-[4/3] rounded-t-[10px] overflow-hidden ${
                          isSelected ? "bg-blue-50" : "bg-gray-50"
                        }`}>
                          {/* TODO: 자재 실물 이미지 (크롤링 후 삽입) */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <ImageIcon className={`w-8 h-8 ${isSelected ? "text-blue-200" : "text-gray-200"}`} />
                            <span className="text-[10px] text-gray-300 mt-1">자재 이미지</span>
                          </div>
                          {/* 등급 배지 */}
                          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${grade.bg} ${grade.border} ${grade.color}`}>
                            {grade.label}
                          </div>
                          {/* 선택 체크 */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {/* 컬러 스와치 */}
                          {product.colorHex && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1">
                              <div
                                className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: product.colorHex }}
                              />
                            </div>
                          )}
                        </div>

                        {/* 정보 */}
                        <div className="p-3">
                          <p className="text-[10px] text-gray-400 mb-0.5">{product.brand}</p>
                          <p className={`text-sm font-bold mb-1 leading-snug ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                            {product.productName}
                          </p>
                          <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{product.spec}</p>

                          {/* 가격 */}
                          <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
                            <div>
                              <span className="text-base font-extrabold text-gray-900">
                                {product.unitPrice.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-0.5">원/{product.unit}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              시공 {product.laborPrice.toLocaleString()}
                            </span>
                          </div>

                          {/* 태그 */}
                          {product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {product.tags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 선택 시 부자재 */}
                          {isSelected && product.subItems.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-100 space-y-0.5">
                              <p className="text-[10px] text-blue-500 font-bold">포함 부자재</p>
                              {product.subItems.map((sub) => (
                                <div key={sub.name} className="flex justify-between">
                                  <span className="text-[10px] text-gray-500">{sub.name}</span>
                                  <span className="text-[10px] text-gray-400">{sub.unitPrice.toLocaleString()}원</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* 모바일 하단 바 */}
      <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(selectedCount / totalCategories) * 100}%` }} />
          </div>
          <span className="text-[11px] text-gray-500">{selectedCount}/{totalCategories}</span>
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
          >
            확인 <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 컨펌 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">자재 선택 확인</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedSummary.length}개 부위 선택 · 물량산출로 이동합니다</p>
              </div>
              <button onClick={() => setShowConfirm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1.5">
              {selectedSummary.map((item) => {
                const grade = GRADE[item.product.priceGrade];
                return (
                  <div key={item.categoryCode} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                    {/* 이미지 미니 */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {item.product.colorHex ? (
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: item.product.colorHex }} />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">{item.category}</span>
                        <span className={`px-1 text-[9px] font-medium rounded ${grade.bg} ${grade.color}`}>
                          {grade.label}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {item.product.brand} {item.product.productName}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0">
                      {item.product.unitPrice.toLocaleString()}원
                    </span>
                  </div>
                );
              })}

              {selectedCount < totalCategories && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 mt-2">
                  <p className="text-xs text-amber-700">
                    <strong>{totalCategories - selectedCount}개 부위</strong> 미선택 — 기본 단가로 산출됩니다
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">예상 단가 합계</span>
                <span className="text-xl font-extrabold text-gray-900">
                  {totalMaterialCost.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">원</span>
                </span>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" />
                확인 완료 · 물량산출로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
