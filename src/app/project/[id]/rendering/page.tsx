"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Package,
  Check,
  X,
  ImageIcon,
  MapPin,
  Palette,
  Search,
  Loader2,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import { useMaterialCatalogV2 } from "@/hooks/useMaterialCatalogV2";
import type { SelectedMaterial } from "@/types/consumer-project";
import { isStatusAtLeast } from "@/types/consumer-project";
import type { ParsedFloorPlan } from "@/types/floorplan";
import { loadFloorPlan } from "@/lib/services/drawing-service";
import {
  getCategoriesForRoom,
  searchProducts,
  type MaterialCategory,
  type MaterialProduct,
} from "@/lib/data/material-catalog-v2";
import dynamic from "next/dynamic";
import type { FloorPlan2DHandle } from "@/components/viewer/FloorPlan2D";

const FloorPlan2D = dynamic(() => import("@/components/viewer/FloorPlan2D"), { ssr: false });

// 등급 스타일
const GRADE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  economy: { label: "경제형", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  standard: { label: "표준형", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  premium: { label: "프리미엄", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};

// 공종 그룹 (도면 없을 때 폴백용)
const FALLBACK_GROUPS = [
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

  // 단계 잠금: 디자인 미완료 시 리다이렉트
  useEffect(() => {
    if (!project) return;
    if (!isStatusAtLeast(project.status, "RENDERING")) {
      router.replace(`/project/${projectId}/design`);
    }
  }, [project, projectId, router]);

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
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState("finish"); // 폴백 모드용
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ category: MaterialCategory; product: MaterialProduct }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floorPlan2DRef = useRef<FloorPlan2DHandle>(null);

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

  // ─── 방 관련 계산 ──────────────────────────────────

  // 자재 선택 가능한 방만 필터 (발코니/다용도실 제외)
  const materialRooms = useMemo(() => {
    if (!floorPlan) return [];
    return floorPlan.rooms.filter((r) => getCategoriesForRoom(r.type).length > 0);
  }, [floorPlan]);

  // 선택된 방 객체
  const selectedRoom = useMemo(
    () => floorPlan?.rooms.find((r) => r.id === selectedRoomId) ?? null,
    [floorPlan, selectedRoomId]
  );

  // 선택된 방의 카테고리
  const roomCategories = useMemo(() => {
    if (!selectedRoom) return [];
    return getCategoriesForRoom(selectedRoom.type);
  }, [selectedRoom]);

  // 방별 완성도
  const roomCompletionStatus = useMemo(() => {
    if (!floorPlan) return {};
    const status: Record<string, "none" | "partial" | "complete"> = {};
    for (const room of floorPlan.rooms) {
      const cats = getCategoriesForRoom(room.type);
      if (cats.length === 0) {
        status[room.id] = "none";
        continue;
      }
      const done = cats.filter((c) => selectedProducts[c.code]).length;
      status[room.id] =
        done === 0 ? "none" : done === cats.length ? "complete" : "partial";
    }
    return status;
  }, [floorPlan, selectedProducts]);

  // 완성된 방 수
  const completedRoomCount = useMemo(() => {
    return materialRooms.filter((r) => roomCompletionStatus[r.id] === "complete").length;
  }, [materialRooms, roomCompletionStatus]);

  // AI 디자인 이미지 (선택된 방)
  const roomDesignImages = useMemo(() => {
    if (!selectedRoom || !project?.design?.generatedImages) return [];
    return project.design.generatedImages.filter(
      (img) =>
        img.roomId === selectedRoomId ||
        img.roomName === selectedRoom.name ||
        (img.description && img.description.includes(selectedRoom.name))
    );
  }, [selectedRoomId, selectedRoom, project?.design?.generatedImages]);

  // 방별 선택 진행률
  const roomProgress = useMemo(() => {
    if (!selectedRoom) return { done: 0, total: 0 };
    const total = roomCategories.length;
    const done = roomCategories.filter((c) => selectedProducts[c.code]).length;
    return { done, total };
  }, [selectedRoom, roomCategories, selectedProducts]);

  // 선택 요약
  const selectedSummary = useMemo(() => {
    const items: { category: string; product: MaterialProduct; categoryCode: string }[] = [];
    for (const cat of allCategories) {
      const pid = selectedProducts[cat.code];
      if (pid) {
        const prod = cat.products.find((p) => p.id === pid);
        if (prod)
          items.push({ category: cat.nameKr, product: prod, categoryCode: cat.code });
      }
    }
    return items;
  }, [allCategories, selectedProducts]);

  // ─── 핸들러 ────────────────────────────────────────

  const handleRoomClick = useCallback(
    (room: { id: string }) => {
      setSelectedRoomId(room.id);
    },
    []
  );

  const handleSelect = useCallback(
    (cat: MaterialCategory, prod: MaterialProduct) => {
      toggleProduct(cat.code, prod.id);
      const isDeselecting = selectedProducts[cat.code] === prod.id;
      if (!isDeselecting) {
        updateMaterial({
          id: prod.id,
          roomId: selectedRoom?.id || "",
          roomName: selectedRoom?.name || "",
          category: cat.nameKr,
          categoryCode: cat.code,
          part: cat.nameKr,
          materialName: `${prod.brand} ${prod.productName}`,
          specification: prod.spec,
          unitPrice: prod.unitPrice,
          laborPrice: prod.laborPrice,
          unit: prod.unit,
          brand: prod.brand,
          productId: prod.id,
          priceGrade: prod.priceGrade,
          priceSource: prod.priceSource,
          subMaterials: prod.subItems,
          confirmed: true,
        });
      }
    },
    [toggleProduct, selectedProducts, updateMaterial, selectedRoom]
  );

  const handleConfirm = useCallback(() => {
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
      allConfirmed: true,
    });
    updateStatus("ESTIMATING");
    router.push(`/project/${projectId}/estimate`);
  }, [
    selectedSummary,
    updateRendering,
    project?.rendering?.views,
    updateStatus,
    router,
    projectId,
  ]);

  // 자재 검색
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/materials?search=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            // DB 검색 결과를 MaterialProduct 형태로 변환하여 카테고리 매칭
            const mapped: { category: MaterialCategory; product: MaterialProduct }[] = [];
            for (const r of data.results) {
              const cat = allCategories.find((c) => c.nameKr === r.category || c.code === r.category);
              if (cat) {
                const existingProd = cat.products.find((p) => p.productName === r.name);
                if (existingProd) {
                  mapped.push({ category: cat, product: existingProd });
                }
              }
            }
            if (mapped.length > 0) {
              setSearchResults(mapped);
              setIsSearching(false);
              return;
            }
          }
        }
      } catch {
        // DB 검색 실패 → 로컬 폴백
      }
      // 로컬 폴백
      setSearchResults(searchProducts(query.trim()));
      setIsSearching(false);
    }, 300);
  }, [allCategories]);

  const sorted = (prods: MaterialProduct[]) => {
    const o: Record<string, number> = { economy: 0, standard: 1, premium: 2 };
    return [...prods].sort((a, b) => (o[a.priceGrade] ?? 0) - (o[b.priceGrade] ?? 0));
  };

  // ─── 폴백: 도면 없을 때 기존 공종 탭 ───────────────

  const fallbackCategories = useMemo(() => {
    const g = FALLBACK_GROUPS.find((g) => g.id === activeGroup);
    if (!g) return [];
    return allCategories.filter((c) => g.codes.includes(c.code));
  }, [activeGroup, allCategories]);

  const fallbackGroupProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const g of FALLBACK_GROUPS) {
      const cats = allCategories.filter((c) => g.codes.includes(c.code));
      map[g.id] = {
        total: cats.length,
        done: cats.filter((c) => selectedProducts[c.code]).length,
      };
    }
    return map;
  }, [allCategories, selectedProducts]);

  // ─── 로딩 ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-gray-50">
        <div className="text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-blue-400 animate-pulse" />
          <p className="text-sm text-gray-500">자재 정보 로딩 중</p>
        </div>
      </div>
    );
  }

  // ─── 카테고리 선택 카드 (공통 렌더러) ───────────────

  const renderCategoryCards = (categories: MaterialCategory[]) => (
    <div className="space-y-8">
      {categories.map((category) => {
        const products = sorted(category.products);
        const selectedId = selectedProducts[category.code];

        return (
          <section key={category.code}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-900">{category.nameKr}</h3>
              {selectedId && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>

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
                    {/* 이미지 placeholder */}
                    <div
                      className={`relative w-full aspect-[4/3] rounded-t-[10px] overflow-hidden ${
                        isSelected ? "bg-blue-50" : "bg-gray-50"
                      }`}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <ImageIcon
                          className={`w-8 h-8 ${isSelected ? "text-blue-200" : "text-gray-200"}`}
                        />
                        <span className="text-[10px] text-gray-300 mt-1">자재 이미지</span>
                      </div>
                      <div
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${grade.bg} ${grade.border} ${grade.color}`}
                      >
                        {grade.label}
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {product.colorHex && (
                        <div className="absolute bottom-2 left-2">
                          <div
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: product.colorHex }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="text-[10px] text-gray-400 mb-0.5">{product.brand}</p>
                      <p
                        className={`text-sm font-bold mb-1 leading-snug ${
                          isSelected ? "text-blue-800" : "text-gray-800"
                        }`}
                      >
                        {product.productName}
                      </p>
                      <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">
                        {product.spec}
                      </p>

                      <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
                        <div>
                          <span className="text-base font-extrabold text-gray-900">
                            {product.unitPrice.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-0.5">
                            원/{product.unit}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          시공 {product.laborPrice.toLocaleString()}
                        </span>
                      </div>

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

                      {isSelected && product.subItems.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-blue-100 space-y-0.5">
                          <p className="text-[10px] text-blue-500 font-bold">포함 부자재</p>
                          {product.subItems.map((sub) => (
                            <div key={sub.name} className="flex justify-between">
                              <span className="text-[10px] text-gray-500">{sub.name}</span>
                              <span className="text-[10px] text-gray-400">
                                {sub.unitPrice.toLocaleString()}원
                              </span>
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
  );

  // ─── 컨펌 모달 ──────────────────────────────────────

  const confirmModal = showConfirm && (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => setShowConfirm(false)}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">자재 선택 확인</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedSummary.length}개 부위 선택 · 물량산출로 이동합니다
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(false)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1.5">
          {selectedSummary.map((item) => {
            const grade = GRADE[item.product.priceGrade];
            return (
              <div
                key={item.categoryCode}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {item.product.colorHex ? (
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: item.product.colorHex }}
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{item.category}</span>
                    <span
                      className={`px-1 text-[9px] font-medium rounded ${grade.bg} ${grade.color}`}
                    >
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
                <strong>{totalCategories - selectedCount}개 부위</strong> 미선택 — 기본 단가로
                산출됩니다
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">예상 단가 합계</span>
            <span className="text-xl font-extrabold text-gray-900">
              {totalMaterialCost.toLocaleString()}
              <span className="text-sm font-normal text-gray-400 ml-0.5">원</span>
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
  );

  // ═══════════════════════════════════════════════════
  // 도면 없을 때: 공종 탭 모드 (도면 이미지 있으면 좌측에 표시)
  // ═══════════════════════════════════════════════════
  if (!floorPlan) {
    const hasFloorPlanImage = !!project?.floorPlanImageUrl;

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
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(selectedCount / totalCategories) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-500">
                  {selectedCount}/{totalCategories}
                </span>
              </div>
              {selectedCount > 0 && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  확인 <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* 공종 그룹 탭 (도면 이미지 없을 때만 상단에 표시, 이미지 있을 때는 좌측 패널) */}
          {!hasFloorPlanImage && (
            <div className="flex items-center gap-0.5 px-4 pb-0 overflow-x-auto scrollbar-hide">
              {FALLBACK_GROUPS.map((g) => {
                const p = fallbackGroupProgress[g.id];
                const isActive = activeGroup === g.id;
                const isDone = p && p.done === p.total;
                return (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(g.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                      isActive ? "text-blue-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    {g.label}
                    {p && !isDone && (
                      <span className="text-[10px] text-gray-400">
                        {p.done}/{p.total}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 메인 영역: 도면 이미지 있으면 좌우 분할, 없으면 단일 영역 */}
        {hasFloorPlanImage ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* 좌측: 도면 이미지 + 공종 그룹 */}
            <div className="md:w-[420px] md:border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
              {/* 도면 이미지 */}
              <div className="p-3 flex-shrink-0">
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={project.floorPlanImageUrl!}
                    alt="도면"
                    className="w-full h-auto max-h-[400px] object-contain"
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-1.5">
                  도면을 참고하여 아래 공종별 자재를 선택하세요
                </p>
              </div>

              {/* 공종 그룹 버튼 */}
              <div className="px-3 pb-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-500">공종 선택</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FALLBACK_GROUPS.map((g) => {
                    const p = fallbackGroupProgress[g.id];
                    const isActive = activeGroup === g.id;
                    const isDone = p && p.done === p.total;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setActiveGroup(g.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : isDone
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : p && p.done > 0
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {g.label}
                        {!isDone && p && (
                          <span className="text-[10px] opacity-60">
                            {p.done}/{p.total}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 우측: 검색 + 자재 카테고리 카드 */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {/* 자재 검색 바 */}
              <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-2">
                <div className="relative max-w-3xl mx-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="자재 검색 (브랜드, 제품명, 규격...)"
                    className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* 검색 결과 또는 카테고리 */}
              {searchQuery.trim() ? (
                <div className="max-w-3xl mx-auto px-4 pb-6">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400 mr-2" />
                      <span className="text-sm text-gray-500">검색 중...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-4">
                        &quot;{searchQuery}&quot; 검색 결과 {searchResults.length}건
                      </p>
                      {renderCategoryCards(
                        Array.from(new Set(searchResults.map((r) => r.category.code)))
                          .map((code) => searchResults.find((r) => r.category.code === code)!.category)
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Search className="w-8 h-8 mx-auto text-gray-200 mb-3" />
                      <p className="text-sm text-gray-400">&quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다</p>
                      <p className="text-xs text-gray-300 mt-1">다른 키워드로 검색해보세요</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-3xl mx-auto px-4 pb-6">
                  {/* 선택된 공종 그룹 헤더 */}
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {FALLBACK_GROUPS.find((g) => g.id === activeGroup)?.label}
                    </h3>
                    {(() => {
                      const p = fallbackGroupProgress[activeGroup];
                      return p ? (
                        <span className="text-xs text-gray-400">
                          {p.done}/{p.total} 선택됨
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {renderCategoryCards(fallbackCategories)}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 도면 이미지도 없을 때: 기존 단일 영역 */
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-6">
              {renderCategoryCards(fallbackCategories)}
            </div>
          </div>
        )}

        {/* 모바일 하단 */}
        <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(selectedCount / totalCategories) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-500">
              {selectedCount}/{totalCategories}
            </span>
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

        {confirmModal}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // 도면 있을 때: 방 클릭 기반 자재 선택 (메인 모드)
  // ═══════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── 상단 바 ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">자재 선택</h2>
            <span className="hidden sm:inline text-[11px] text-gray-400">
              {floorPlan.totalArea}m²
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">
                {completedRoomCount}/{materialRooms.length} 공간 완료
              </span>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${materialRooms.length > 0 ? (completedRoomCount / materialRooms.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(selectedCount / totalCategories) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-gray-500">
                {selectedCount}/{totalCategories}
              </span>
            </div>
            {selectedCount > 0 && (
              <button
                onClick={() => setShowConfirm(true)}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                선택 완료 <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 메인 ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 좌측: 평면도 + AI 참조 + 방 목록 */}
        <div className="md:w-[420px] md:border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          {/* 평면도 */}
          <div className="p-3 flex-shrink-0">
            <div className="h-[250px] md:h-[300px]">
              <FloorPlan2D
                ref={floorPlan2DRef}
                floorPlan={floorPlan}
                selectedRoomId={selectedRoomId || undefined}
                onRoomClick={handleRoomClick}
                roomCompletionStatus={roomCompletionStatus}
                className="h-full"
                showDimensions={false}
                showFixtures={true}
              />
            </div>
          </div>

          {/* AI 디자인 참조 */}
          {selectedRoom && (
            <div className="px-3 pb-3 flex-shrink-0">
              {roomDesignImages.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11px] font-medium text-gray-500">
                      AI 디자인 참조
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {roomDesignImages.map((img) => (
                      <img
                        key={img.id}
                        src={img.imageData}
                        alt={img.description || "AI 디자인"}
                        className="h-24 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-3 text-center">
                  <Palette className="w-5 h-5 mx-auto text-gray-300 mb-1" />
                  <p className="text-[10px] text-gray-400">
                    AI 디자인 이미지가 없습니다
                  </p>
                  <p className="text-[10px] text-gray-300">
                    디자인하기 탭에서 AI 디자인을 생성해보세요
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 공간 목록 */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] font-medium text-gray-500">공간 선택</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {materialRooms.map((room) => {
                const isActive = room.id === selectedRoomId;
                const status = roomCompletionStatus[room.id];
                const cats = getCategoriesForRoom(room.type);
                const done = cats.filter((c) => selectedProducts[c.code]).length;
                const isComplete = status === "complete";

                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : isComplete
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : status === "partial"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : null}
                    {room.name}
                    {!isComplete && (
                      <span className="text-[10px] opacity-60">
                        {done}/{cats.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 자재 카테고리 */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {/* 자재 검색 바 */}
          <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-2">
            <div className="relative max-w-3xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="자재 검색 (브랜드, 제품명, 규격...)"
                className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* 검색 결과 */}
          {searchQuery.trim() ? (
            <div className="max-w-3xl mx-auto px-4 pb-6">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400 mr-2" />
                  <span className="text-sm text-gray-500">검색 중...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-400 mb-4">
                    &quot;{searchQuery}&quot; 검색 결과 {searchResults.length}건
                  </p>
                  <div className="space-y-6">
                    {/* 카테고리별 그룹핑 */}
                    {Array.from(new Set(searchResults.map((r) => r.category.code))).map((catCode) => {
                      const catResults = searchResults.filter((r) => r.category.code === catCode);
                      const cat = catResults[0].category;
                      return (
                        <section key={catCode}>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-sm font-bold text-gray-900">{cat.nameKr}</h3>
                            {selectedProducts[cat.code] && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {catResults.map(({ product }) => {
                              const isSelected = selectedProducts[cat.code] === product.id;
                              const grade = GRADE[product.priceGrade];
                              return (
                                <button
                                  key={product.id}
                                  onClick={() => handleSelect(cat, product)}
                                  className={`group relative text-left rounded-xl border-2 transition-all ${
                                    isSelected
                                      ? "border-blue-500 bg-white shadow-md"
                                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                                  }`}
                                >
                                  <div className={`relative w-full aspect-[4/3] rounded-t-[10px] overflow-hidden ${isSelected ? "bg-blue-50" : "bg-gray-50"}`}>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <ImageIcon className={`w-8 h-8 ${isSelected ? "text-blue-200" : "text-gray-200"}`} />
                                      <span className="text-[10px] text-gray-300 mt-1">자재 이미지</span>
                                    </div>
                                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${grade.bg} ${grade.border} ${grade.color}`}>
                                      {grade.label}
                                    </div>
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-3">
                                    <p className="text-[10px] text-gray-400 mb-0.5">{product.brand}</p>
                                    <p className={`text-sm font-bold mb-1 leading-snug ${isSelected ? "text-blue-800" : "text-gray-800"}`}>
                                      {product.productName}
                                    </p>
                                    <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{product.spec}</p>
                                    <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
                                      <div>
                                        <span className="text-base font-extrabold text-gray-900">{product.unitPrice.toLocaleString()}</span>
                                        <span className="text-[10px] text-gray-400 ml-0.5">원/{product.unit}</span>
                                      </div>
                                      <span className="text-[10px] text-gray-400">시공 {product.laborPrice.toLocaleString()}</span>
                                    </div>
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
              ) : (
                <div className="text-center py-12">
                  <Search className="w-8 h-8 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">&quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다</p>
                  <p className="text-xs text-gray-300 mt-1">다른 키워드로 검색해보세요</p>
                </div>
              )}
            </div>
          ) : selectedRoom ? (
            <div className="max-w-3xl mx-auto px-4 pb-6">
              {/* 방 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      roomProgress.done === roomProgress.total
                        ? "bg-green-100"
                        : "bg-blue-100"
                    }`}
                  >
                    {roomProgress.done === roomProgress.total ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Package className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedRoom.name}
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        {selectedRoom.area}m²
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">
                      {roomProgress.done}/{roomProgress.total} 부위 선택됨
                    </p>
                  </div>
                </div>
                {/* 방 진행 바 */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        roomProgress.done === roomProgress.total
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width: `${roomProgress.total > 0 ? (roomProgress.done / roomProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 카테고리 카드 그리드 */}
              {roomCategories.length > 0 ? (
                renderCategoryCards(roomCategories)
              ) : (
                <div className="text-center py-16">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm text-gray-400">
                    이 공간은 별도 자재 선택이 필요하지 않습니다
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* 방 미선택 상태 */
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">
                  도면에서 방을 선택해주세요
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  방을 클릭하면 해당 공간에 필요한 자재를 선택할 수 있습니다
                </p>
                {/* 방 칩 바로가기 */}
                <div className="flex flex-wrap justify-center gap-2">
                  {materialRooms.map((room) => {
                    const status = roomCompletionStatus[room.id];
                    const cats = getCategoriesForRoom(room.type);
                    const done = cats.filter((c) => selectedProducts[c.code]).length;
                    const isComplete = status === "complete";

                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isComplete
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : status === "partial"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {isComplete && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {room.name}
                        {!isComplete && (
                          <span className="text-xs opacity-50">
                            {done}/{cats.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일 하단 바 ── */}
      <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-30">
        <div>
          {selectedRoom ? (
            <span className="text-xs font-medium text-gray-600">
              {selectedRoom.name} {roomProgress.done}/{roomProgress.total}
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {selectedCount}/{totalCategories} 선택
            </span>
          )}
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg"
          >
            선택 완료 <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {confirmModal}
    </div>
  );
}
