/* eslint-disable @next/next/no-img-element */
/**
 * 자재 수정 에디터 — 가이드 InPick_Segmentation_Material_Replacement_Guide 기반 구현.
 *
 * 흐름:
 * 1. "자재 영역 분석 (1토큰)" → /api/inpick/extract-material-regions (SegmentationData)
 * 2. SVG <polygon> 오버레이로 클릭 가능 영역 표시 (가이드 §3-1)
 * 3. 영역 클릭 → 카테고리별 자재 라이브러리 모달 (/api/inpick/material-library)
 * 4. 자재 선택 시 region.current_material_sku 업데이트
 * 5. "고화질 재렌더 (2토큰)" → /api/inpick/refine-render (gpt-image-2 alpha-mask edit)
 * 6. 모든 영역 자재 선택 후 "견적 보기" → /api/inpick/segmentation-estimate
 *
 * 마스크 규칙 (가이드 §2-1):
 *   - 변경할 영역 = 투명 (alpha=0)
 *   - 보존할 영역 = 불투명 (alpha=255)
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hexagon, Loader2, Wand2, Sparkles, X, Edit3, Check, Crosshair, Grid3x3 } from "lucide-react";
import type { RenderItem } from "./Step2Designer";
import type {
  SegmentationData,
  SegRegion,
  CatalogMaterial,
  InteriorCategory,
} from "@/types/segmentation";
import ClickableRenderImage from "./ClickableRenderImage";
import type { SamPolygonResult } from "@/hooks/useSamClient";

interface Props {
  roomLabel: string;
  /** 전용면적 m² — pixel→sqm 환산용 (가이드 §1-4) */
  realWorldAreaSqm?: number;
  styleHint?: string;
  renderItem: RenderItem;
  tokenBalance: number;
  onConsumeToken: (
    amount: number,
    feature: "ai_render" | "drawing_option",
  ) => Promise<boolean>;
  onUpdate: (next: RenderItem) => void;
}

export default function MaterialEditor({
  roomLabel,
  realWorldAreaSqm,
  styleHint,
  renderItem,
  tokenBalance,
  onConsumeToken,
  onUpdate,
}: Props) {
  // SegmentationData가 RenderItem.materialRegions(legacy) 또는 segmentation에 보관됨
  // legacy 호환: RenderItem에 segmentation 필드 추가
  const segmentation = renderItem.segmentation as SegmentationData | undefined;
  const [extracting, setExtracting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);

  // 모드 — "auto" (전체 자동 분석) / "sam" (사용자 클릭 정밀 분할)
  // 가이드 권장: SAM 클릭이 더 정확하지만 RunPod 환경 필요. auto는 GPT-4o Vision으로 실행 가능.
  const [editMode, setEditMode] = useState<"auto" | "sam">("auto");
  const [samSelection, setSamSelection] = useState<SamPolygonResult | null>(null);
  const [samCategoryPicker, setSamCategoryPicker] = useState(false); // 카테고리 선택 모달
  // expensesRatio knob 제거 — spec §C는 고정 요율 (산안비 3.11% / 일반관리비 5% / 이윤 10%) 사용.
  // 사업자별 요율 수정은 Phase 2 `/business/bids/[bidId]/edit-rates`에서 처리.

  const hasEdits = useMemo(
    () =>
      !!segmentation?.regions.some(
        (r) => r.current_material && r.current_material_sku,
      ),
    [segmentation],
  );

  const replaceableCount = segmentation?.regions.filter((r) => r.is_replaceable).length || 0;
  const decidedCount = segmentation?.regions.filter((r) => r.current_material_sku).length || 0;

  // 1) 영역 추출
  const handleExtract = async () => {
    if (tokenBalance < 1) {
      setError("토큰 부족 — 1토큰 필요");
      return;
    }
    // 클릭 즉시 시각 피드백 (토큰 차감 await 전에 먼저 로딩 ON)
    setExtracting(true);
    setError(null);
    const ok = await onConsumeToken(1, "drawing_option");
    if (!ok) {
      setExtracting(false);
      setError("토큰 차감 실패");
      return;
    }
    try {
      const res = await fetch("/api/inpick/extract-material-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: renderItem.url,
          roomName: roomLabel,
          realWorldAreaSqm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error + (data.hint ? `\n→ ${data.hint}` : ""));
      }
      onUpdate({ ...renderItem, segmentation: data as SegmentationData });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExtracting(false);
    }
  };

  // 2) 자재 선택 (모달에서 호출)
  const handleMaterialSelect = (regionId: string, material: CatalogMaterial) => {
    if (!segmentation) return;
    const next: SegmentationData = {
      ...segmentation,
      regions: segmentation.regions.map((r) =>
        r.id === regionId
          ? {
              ...r,
              current_material: material.name,
              current_material_sku: material.sku,
              guessed_color_hex: material.color_hex || r.guessed_color_hex,
            }
          : r,
      ),
    };
    onUpdate({ ...renderItem, segmentation: next });
    setActiveRegionId(null);
  };

  // SAM 모드 — 클릭으로 선택한 영역 + 카테고리 선택 → 자재 라이브러리 → refine-render 직접 호출
  const handleSamConfirm = (region: SamPolygonResult) => {
    setSamSelection(region);
    setSamCategoryPicker(true); // 카테고리 선택 모달
  };

  const handleSamCategoryAndMaterial = async (
    category: InteriorCategory,
    material: CatalogMaterial,
  ) => {
    if (!samSelection) return;
    if (tokenBalance < 2) {
      setError("토큰 부족 — 고화질 재렌더는 2토큰 필요");
      return;
    }
    setSamCategoryPicker(false);
    setRefining(true);
    setError(null);
    const ok = await onConsumeToken(2, "drawing_option");
    if (!ok) {
      setRefining(false);
      setError("토큰 차감 실패");
      return;
    }
    try {
      // SAM polygon → alpha mask → refine-render 호출
      const [w, h] = samSelection.image_size;
      const maskBase64 = await buildAlphaMaskFromPolygon(w, h, samSelection.polygon);

      const res = await fetch("/api/inpick/refine-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: renderItem.url,
          maskBase64,
          prompt: `${material.description}`,
          roomName: roomLabel,
          styleHint,
          regionCategoryEn: ["floor", "wall", "ceiling", "window", "door", "curtain"].includes(category)
            ? category
            : undefined,
          materialName: material.name,
          materialColor: material.color,
          materialTexture: material.texture,
          materialFinish: material.finish,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error + (data.hint ? `\n→ ${data.hint}` : ""));
      onUpdate({
        ...renderItem,
        refinedUrl: data.imageUrl,
        refinedAt: new Date().toISOString(),
      });
      setSamSelection(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  // 3) 고화질 재렌더 — 선택된 영역만 alpha-mask edit (자동 분석 모드용)
  const handleRefine = async () => {
    if (!segmentation || !hasEdits) return;
    if (tokenBalance < 2) {
      setError("토큰 부족 — 고화질 재렌더는 2토큰 필요");
      return;
    }

    // 사용자가 자재 변경한 영역들
    const editedRegions = segmentation.regions.filter(
      (r) => r.current_material && r.current_material_sku,
    );
    if (editedRegions.length === 0) return;

    // 클릭 즉시 시각 피드백
    setRefining(true);
    setError(null);
    const ok = await onConsumeToken(2, "drawing_option");
    if (!ok) {
      setRefining(false);
      setError("토큰 차감 실패");
      return;
    }
    try {
      // 한 번에 여러 영역을 alpha 마스크로 묶음 (모든 변경 영역을 투명 처리)
      const [w, h] = segmentation.image_size;
      const maskBase64 = await buildAlphaMask(w, h, editedRegions);

      // 카테고리 라벨 + 자재 묘사 합치기
      const promptParts = editedRegions
        .map((r) => `${r.label_ko}: ${r.current_material}`)
        .join(", ");

      // 대표 카테고리 (다중 영역이면 첫 영역 기준 — gpt-image-2가 prompt 자체로 다중 처리)
      const firstCat = editedRegions[0].category;

      const res = await fetch("/api/inpick/refine-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: renderItem.url,
          maskBase64,
          prompt: promptParts,
          roomName: roomLabel,
          styleHint,
          regionCategoryEn: ["floor", "wall", "ceiling", "window", "door", "curtain"].includes(firstCat)
            ? firstCat
            : undefined,
          materialName: editedRegions.map((r) => r.current_material).join(" + "),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error + (data.hint ? `\n→ ${data.hint}` : ""));

      onUpdate({
        ...renderItem,
        refinedUrl: data.imageUrl,
        refinedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/30 p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold tracking-tight text-primary-900 inline-flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary-500" />
            자재 수정 + 견적 산출
          </p>
          <p className="mt-0.5 text-[0.72rem] text-primary-900/50">
            {editMode === "auto"
              ? "전체 영역 자동 분석 → 영역별 자재 선택 → 고화질 재렌더"
              : "원하는 부위만 정확히 클릭 → 자재 즉시 교체 (가장 정밀)"}
          </p>
        </div>

        {/* 모드 토글 */}
        <div className="inline-flex items-center gap-0.5 rounded-full border border-primary-200 bg-white p-0.5 text-[0.7rem] font-bold">
          <button
            type="button"
            onClick={() => setEditMode("auto")}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition-colors ${
              editMode === "auto"
                ? "bg-primary-500 text-white"
                : "text-primary-900/60 hover:text-primary-900"
            }`}
          >
            <Grid3x3 className="h-3 w-3" /> 전체 분석
          </button>
          <button
            type="button"
            onClick={() => setEditMode("sam")}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition-colors ${
              editMode === "sam"
                ? "bg-primary-500 text-white"
                : "text-primary-900/60 hover:text-primary-900"
            }`}
          >
            <Crosshair className="h-3 w-3" /> 부위 선택 (정밀)
          </button>
        </div>

        {editMode === "auto" && !segmentation && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-primary-600 disabled:opacity-60"
          >
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 영역 분석 중…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                자재 영역 분석 시작
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[0.7rem]">
                  <Hexagon className="h-2.5 w-2.5 fill-white" /> 1
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* SAM 클릭 모드 — 이미지 + 클릭 분할 */}
      {editMode === "sam" && (
        <div className="mt-4">
          <ClickableRenderImage
            imageUrl={renderItem.refinedUrl || renderItem.url}
            onConfirm={handleSamConfirm}
            initialMode="select"
            hint="첫 호출은 cold start로 30~60초 소요. 이후 1~3초"
          />
        </div>
      )}

      {extracting && (
        <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50/50 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-primary-900">
            자재 영역 분석 중 — 잠시만 기다려주세요
          </p>
          <p className="mt-1 text-xs text-primary-900/60">
            바닥 / 벽 / 천장 / 창호 / 가구 영역을 자동으로 인식하고 있습니다 (5~30초)
          </p>
        </div>
      )}
      {refining && (
        <div className="mt-4 rounded-xl border border-primary-300 bg-primary-50 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-primary-900">
            고화질 재렌더 중 — 잠시만 기다려주세요
          </p>
          <p className="mt-1 text-xs text-primary-900/60">
            선택한 영역만 새 자재로 다시 생성 (가구·조명·창문은 그대로 유지) · 약 40~80초
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {editMode === "auto" && segmentation && (
        <>
          {/* 진행 상태 */}
          <div className="mt-4 flex items-center justify-between text-[0.7rem] text-primary-900/60">
            <span>
              영역 {segmentation.total_regions}개 (시공 가능 {replaceableCount}개)
            </span>
            <span>
              자재 선택: <strong className="text-emerald-600">{decidedCount}</strong> / {replaceableCount}
            </span>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {/* 좌: 클릭 가능 SVG 오버레이 이미지 */}
            <div className="relative aspect-square overflow-hidden rounded-xl border border-primary-100 bg-white">
              <img
                src={renderItem.refinedUrl || renderItem.url}
                alt="design"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                {segmentation.regions.map((r) => {
                  const points = r.polygon.map(([x, y]) => `${x},${y}`).join(" ");
                  const decided = !!r.current_material_sku;
                  const active = activeRegionId === r.id;
                  const replaceable = r.is_replaceable;
                  return (
                    <polygon
                      key={r.id}
                      points={points}
                      onClick={() => replaceable && setActiveRegionId(r.id)}
                      style={{
                        cursor: replaceable ? "pointer" : "not-allowed",
                        pointerEvents: replaceable ? "auto" : "none",
                        transition: "all 0.2s ease-out",
                      }}
                      fill={
                        active
                          ? "rgba(247, 59, 32, 0.30)"
                          : decided
                            ? "rgba(76, 175, 80, 0.18)"
                            : replaceable
                              ? "rgba(247, 59, 32, 0.06)"
                              : "rgba(0, 0, 0, 0.0)"
                      }
                      stroke={
                        active
                          ? "#F73B20"
                          : decided
                            ? "#10B981"
                            : replaceable
                              ? "rgba(247, 59, 32, 0.4)"
                              : "rgba(0, 0, 0, 0.0)"
                      }
                      strokeWidth={active ? 0.006 : 0.003}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
              {renderItem.refinedUrl && (
                <div className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                  ✓ 고화질 재렌더 완료
                </div>
              )}
            </div>

            {/* 우: 영역 리스트 */}
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50 mb-2">
                자재 영역
              </p>
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {segmentation.regions
                  .filter((r) => r.is_replaceable)
                  .map((r) => (
                    <RegionListItem
                      key={r.id}
                      region={r}
                      active={activeRegionId === r.id}
                      onClick={() => setActiveRegionId(r.id)}
                    />
                  ))}
              </ul>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {hasEdits && (
                  <button
                    onClick={handleRefine}
                    disabled={refining}
                    className="col-span-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
                  >
                    {refining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        고화질 재렌더 중…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        고화질 재렌더 (수정 영역만)
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.7rem]">
                          <Hexagon className="h-3 w-3 fill-white" /> 2
                        </span>
                      </>
                    )}
                  </button>
                )}
                {hasEdits && (
                  <button
                    onClick={() => setEstimateOpen(true)}
                    className="col-span-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-900 hover:bg-primary-50"
                  >
                    💰 견적 보기 ({decidedCount}개 영역)
                  </button>
                )}
              </div>

              {!hasEdits && (
                <p className="mt-3 text-[0.7rem] text-primary-900/50 text-center">
                  영역을 클릭하면 자재 라이브러리가 열립니다
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* 자재 라이브러리 모달 */}
      <AnimatePresence>
        {activeRegionId && segmentation && (
          <MaterialLibraryModal
            region={segmentation.regions.find((r) => r.id === activeRegionId)!}
            currentSku={
              segmentation.regions.find((r) => r.id === activeRegionId)?.current_material_sku || null
            }
            onClose={() => setActiveRegionId(null)}
            onSelect={(material) => handleMaterialSelect(activeRegionId, material)}
          />
        )}
      </AnimatePresence>

      {/* 견적 모달 */}
      <AnimatePresence>
        {estimateOpen && segmentation && (
          <EstimateModal
            segmentation={segmentation}
            onClose={() => setEstimateOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* SAM 모드 — 카테고리 + 자재 선택 모달 */}
      <AnimatePresence>
        {samCategoryPicker && samSelection && (
          <SamCategoryMaterialModal
            onClose={() => {
              setSamCategoryPicker(false);
              setSamSelection(null);
            }}
            onSelect={(cat, mat) => handleSamCategoryAndMaterial(cat, mat)}
          />
        )}
      </AnimatePresence>

      {/* SAM refining — 큰 로딩 패널 */}
      {refining && editMode === "sam" && (
        <div className="mt-4 rounded-xl border border-primary-300 bg-primary-50 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-primary-900">
            선택한 영역에 새 자재 적용 중 — 약 40~80초
          </p>
          <p className="mt-1 text-xs text-primary-900/60">
            마스크 영역만 새 자재로 재생성, 나머지는 그대로 유지
          </p>
        </div>
      )}
    </div>
  );
}

// ──────────────── SAM 클릭 후 카테고리 + 자재 선택 모달 ────────────────
function SamCategoryMaterialModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (category: InteriorCategory, material: CatalogMaterial) => void;
}) {
  const [category, setCategory] = useState<InteriorCategory>("floor");
  const [materials, setMaterials] = useState<CatalogMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const REPLACEABLE_CATS: { v: InteriorCategory; label: string }[] = [
    { v: "floor", label: "바닥" },
    { v: "wall", label: "벽" },
    { v: "ceiling", label: "천장" },
    { v: "window", label: "창문" },
    { v: "door", label: "문" },
    { v: "curtain", label: "커튼" },
  ];

  useEffect(() => {
    setLoading(true);
    setSelectedSku(null);
    fetch(`/api/inpick/material-library?category=${category}`)
      .then((r) => r.json())
      .then((d) => {
        setMaterials(d.materials || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-primary-100 bg-white p-5 shadow-card-hover"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-primary-900">
              선택한 영역의 자재 변경
            </h3>
            <p className="mt-1 text-xs text-primary-900/60">
              먼저 카테고리(바닥/벽/창 등) 선택 → 자재 라이브러리에서 적용할 자재 선택
            </p>
          </div>
          <button onClick={onClose} className="text-primary-900/50 hover:text-primary-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 카테고리 선택 */}
        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-primary-900/50 mb-2">
            카테고리
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REPLACEABLE_CATS.map((c) => (
              <button
                key={c.v}
                onClick={() => setCategory(c.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === c.v
                    ? "bg-primary-500 text-white"
                    : "bg-primary-50 text-primary-900/70 hover:bg-primary-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 자재 그리드 */}
        <div className="mt-4">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500 mx-auto" />
              <p className="mt-2 text-xs text-primary-900/50">자재 카탈로그 불러오는 중…</p>
            </div>
          ) : materials.length === 0 ? (
            <p className="py-6 text-center text-xs text-primary-900/60">
              이 카테고리는 자재가 없습니다
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {materials.map((m) => {
                const sel = selectedSku === m.sku;
                return (
                  <button
                    key={m.sku}
                    onClick={() => setSelectedSku(m.sku)}
                    className={`text-left rounded-xl border-2 p-3 transition-all ${
                      sel
                        ? "border-primary-500 bg-primary-50/50 shadow-sm"
                        : "border-primary-100 bg-white hover:border-primary-300"
                    }`}
                  >
                    <div
                      className="aspect-square w-full rounded-lg border border-primary-100 mb-2"
                      style={{ background: m.color_hex || "#eee" }}
                    />
                    <p className="text-xs font-bold text-primary-900 leading-tight truncate">
                      {m.name}
                    </p>
                    {m.brand && (
                      <p className="text-[0.65rem] text-primary-900/50 truncate">{m.brand}</p>
                    )}
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[0.7rem] font-bold text-primary-700 tabular">
                        ₩{(m.material_price + m.labor_price).toLocaleString()}
                        <span className="font-medium text-primary-900/50">
                          /{m.unit === "sqm" ? "㎡" : m.unit === "m" ? "m" : "EA"}
                        </span>
                      </p>
                      <p className="text-[0.55rem] text-primary-900/50 tabular">
                        자재 ₩{m.material_price.toLocaleString()} + 인건 ₩{m.labor_price.toLocaleString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
          >
            취소
          </button>
          <button
            onClick={() => {
              const m = materials.find((x) => x.sku === selectedSku);
              if (m) onSelect(category, m);
            }}
            disabled={!selectedSku}
            className="flex-[2] rounded-full bg-primary-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:bg-primary-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Wand2 className="h-4 w-4" />
            적용 + 고화질 재렌더
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]">
              <Hexagon className="h-3 w-3 fill-white" /> 2
            </span>
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ──────────────── 영역 리스트 아이템 ────────────────
function RegionListItem({
  region,
  active,
  onClick,
}: {
  region: SegRegion;
  active: boolean;
  onClick: () => void;
}) {
  const decided = !!region.current_material_sku;
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-all ${
          active
            ? "border-primary-500 bg-white shadow-sm"
            : decided
              ? "border-emerald-300 bg-emerald-50"
              : "border-primary-100 bg-white/70 hover:border-primary-300"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-3 w-3 rounded-full border border-primary-200 shrink-0"
              style={{ background: region.guessed_color_hex || "#fff" }}
            />
            <span className="font-semibold text-primary-900 truncate">
              {region.label_ko}
              {region.area_sqm ? (
                <span className="ml-1 text-[0.65rem] text-primary-900/50 tabular">
                  · {region.area_sqm.toFixed(1)}㎡
                </span>
              ) : null}
            </span>
          </div>
          {decided && <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />}
        </div>
        <div className="mt-1 text-primary-900/70">
          {decided ? (
            <>
              <span className="font-semibold text-emerald-700">{region.current_material}</span>
            </>
          ) : (
            <span className="text-primary-900/40">
              {region.guessed_material || "자재 미선택 — 클릭"}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

// ──────────────── 자재 라이브러리 모달 ────────────────
function MaterialLibraryModal({
  region,
  currentSku,
  onClose,
  onSelect,
}: {
  region: SegRegion;
  currentSku: string | null;
  onClose: () => void;
  onSelect: (m: CatalogMaterial) => void;
}) {
  const [materials, setMaterials] = useState<CatalogMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<string | null>(currentSku);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/inpick/material-library?category=${region.category}`)
      .then((r) => r.json())
      .then((d) => {
        setMaterials(d.materials || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [region.category]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-primary-100 bg-white p-5 shadow-card-hover"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-primary-900">
              {region.label_ko} 자재 선택
            </h3>
            <p className="mt-1 text-xs text-primary-900/60">
              {region.area_sqm ? `면적: ${region.area_sqm.toFixed(2)}㎡ · ` : ""}
              {region.guessed_material ? `현재 추정: ${region.guessed_material}` : "현재 자재 미상"}
            </p>
          </div>
          <button onClick={onClose} className="text-primary-900/50 hover:text-primary-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500 mx-auto" />
            <p className="mt-2 text-xs text-primary-900/50">자재 카탈로그 불러오는 중…</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="py-12 text-center text-sm text-primary-900/60">
            이 카테고리는 아직 자재 카탈로그가 없습니다
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {materials.map((m) => {
              const sel = selectedSku === m.sku;
              return (
                <button
                  key={m.sku}
                  onClick={() => setSelectedSku(m.sku)}
                  className={`text-left rounded-xl border-2 p-3 transition-all ${
                    sel
                      ? "border-primary-500 bg-primary-50/50 shadow-sm"
                      : "border-primary-100 bg-white hover:border-primary-300"
                  }`}
                >
                  <div
                    className="aspect-square w-full rounded-lg border border-primary-100 mb-2"
                    style={{ background: m.color_hex || "#eee" }}
                  />
                  <p className="text-xs font-bold text-primary-900 leading-tight truncate">
                    {m.name}
                  </p>
                  {m.brand && (
                    <p className="text-[0.65rem] text-primary-900/50 truncate">{m.brand}</p>
                  )}
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[0.7rem] font-bold text-primary-700 tabular">
                      ₩{(m.material_price + m.labor_price).toLocaleString()}
                      <span className="font-medium text-primary-900/50">
                        /{m.unit === "sqm" ? "㎡" : m.unit === "m" ? "m" : "EA"}
                      </span>
                    </p>
                    <p className="text-[0.55rem] text-primary-900/50 tabular">
                      자재 ₩{m.material_price.toLocaleString()} + 인건 ₩{m.labor_price.toLocaleString()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
          >
            취소
          </button>
          <button
            onClick={() => {
              const m = materials.find((x) => x.sku === selectedSku);
              if (m) onSelect(m);
            }}
            disabled={!selectedSku}
            className="flex-1 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-cta hover:bg-primary-600 disabled:opacity-50"
          >
            적용하기
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ──────────────── 견적 모달 (spec §A-3 — 12 공종 그룹핑 + 단가 컬럼 제거) ────────────────
function EstimateModal({
  segmentation,
  onClose,
}: {
  segmentation: SegmentationData;
  onClose: () => void;
}) {
  const [estimate, setEstimate] = useState<EstimateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/inpick/segmentation-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentation }),
    })
      .then((r) => r.json())
      .then((d) => {
        setEstimate(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [segmentation]);

  const sections = estimate?.sections ?? [];
  const indirect = estimate?.indirectCosts;
  const totalAmount = estimate?.totalAmount ?? estimate?.total ?? 0;
  const directCost = estimate?.directCostSubtotal ?? estimate?.direct_total ?? 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-primary-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-1rem)] max-w-xl max-h-[92vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-primary-100 bg-white p-5 shadow-card-hover"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-primary-900">
              견적서 (총괄표 + 내역서)
            </h3>
            <p className="mt-0.5 text-[0.65rem] text-primary-900/50">
              spec §A — 12 공종 그룹 · 2026 KICT 표준품셈 + KPI 원가계산
            </p>
          </div>
          <button onClick={onClose} className="text-primary-900/50 hover:text-primary-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500 mx-auto" />
          </div>
        ) : !estimate || sections.length === 0 ? (
          <p className="py-8 text-center text-sm text-primary-900/60">
            자재가 선택된 영역이 없습니다
          </p>
        ) : (
          <>
            {/* ─── 총 견적 금액 (큰 박스, spec §A-1) ─── */}
            <div className="mt-4 rounded-2xl border-2 border-primary-900 bg-gradient-to-br from-primary-50/40 to-amber-50/40 p-4">
              <p className="text-[0.65rem] font-bold text-primary-900/60 tracking-widest">
                총 견적 금액 (VAT 포함)
              </p>
              <p className="mt-1 text-2xl font-extrabold text-primary-500 tabular">
                ₩{totalAmount.toLocaleString()}
              </p>
              {estimate.indirectCosts?.modified && (
                <p className="mt-1 text-[0.65rem] text-amber-700">
                  사업자 입찰 요율 적용됨
                </p>
              )}
            </div>

            {/* ─── 총괄표 (12 공종 + 간접비 5종, spec §A-2) ─── */}
            <div className="mt-4">
              <p className="text-[0.7rem] font-bold text-primary-900/70 mb-2">
                공종별 소계
              </p>
              <ul className="rounded-xl border border-primary-200 divide-y divide-primary-100 overflow-hidden">
                {sections.map((sec) => {
                  const isOpen = expandedSection === sec.sectionId;
                  return (
                    <li key={sec.sectionId} className="bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedSection(isOpen ? null : sec.sectionId)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-primary-50/50 text-left"
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[0.65rem] font-bold text-primary-900/40 tabular shrink-0">
                            {sec.sectionNumber}
                          </span>
                          <span className="text-sm font-bold text-primary-900 truncate">
                            {sec.sectionName}
                          </span>
                          <span className="text-[0.65rem] text-primary-900/40 shrink-0">
                            ({sec.items.length}건)
                          </span>
                        </span>
                        <span className="text-sm font-extrabold text-primary-900 tabular shrink-0">
                          ₩{sec.subtotal.total.toLocaleString()}
                        </span>
                      </button>
                      {/* 내역서 (spec §A-3 — 품명 / 단위 / 수량 / 자재비 / 노무비 / 경비 / 합계) */}
                      {isOpen && (
                        <div className="bg-primary-50/30 px-3 py-2 border-t border-primary-100">
                          <ul className="space-y-1.5">
                            {sec.items.map((it) => (
                              <li key={it.itemId} className="text-[0.7rem] tabular">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-primary-900 truncate flex-1">
                                    {it.name}
                                    {it.spec && (
                                      <span className="ml-1 text-primary-900/50 font-normal">
                                        · {it.spec}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-bold text-primary-900 shrink-0">
                                    ₩{it.totalCost.toLocaleString()}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.62rem] text-primary-900/55">
                                  <span>
                                    {it.quantity.toLocaleString()}{" "}
                                    {it.unit === "sqm" ? "㎡" : it.unit === "m" ? "m" : it.unit}
                                  </span>
                                  {it.materialCost > 0 && (
                                    <span>자재 ₩{it.materialCost.toLocaleString()}</span>
                                  )}
                                  {it.laborCost > 0 && (
                                    <span>노무 ₩{it.laborCost.toLocaleString()}</span>
                                  )}
                                  {it.expenseCost > 0 && (
                                    <span>경비 ₩{it.expenseCost.toLocaleString()}</span>
                                  )}
                                  {it.source === "standard" && (
                                    <span className="text-primary-500/70">표준</span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                          {/* 공종 소계 (3분할: 자재 / 노무 / 경비) */}
                          <div className="mt-2 pt-2 border-t border-primary-200 flex justify-between text-[0.62rem] text-primary-900/60 tabular">
                            <span>자재 ₩{sec.subtotal.materialCost.toLocaleString()}</span>
                            <span>노무 ₩{sec.subtotal.laborCost.toLocaleString()}</span>
                            <span>경비 ₩{sec.subtotal.expenseCost.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ─── 직접공사비 합 + 간접비 5종 (spec §C — 총괄표 하단) ─── */}
            <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between font-bold text-primary-900">
                <span>직접공사비 합</span>
                <span className="tabular">₩{Math.round(directCost).toLocaleString()}</span>
              </div>
              {indirect && (
                <>
                  <div className="flex justify-between text-primary-900/75 border-t border-primary-200 pt-1.5">
                    <span>가설공사비 (보양·자재·폐기물)</span>
                    <span className="tabular">₩{Math.round(indirect.setupCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-primary-900/75">
                    <span>
                      산업안전보건관리비
                      <span className="ml-1 text-[0.62rem] text-primary-900/40">
                        ({(indirect.appliedRates?.safety_rate ?? 0.0311) * 100}%)
                      </span>
                    </span>
                    <span className="tabular">₩{Math.round(indirect.safetyCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-primary-900/75">
                    <span>
                      일반관리비
                      <span className="ml-1 text-[0.62rem] text-primary-900/40">
                        ({((indirect.appliedRates?.general_management_rate ?? 0.05) * 100).toFixed(1)}%)
                      </span>
                    </span>
                    <span className="tabular">₩{Math.round(indirect.generalManagementCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-primary-900/75">
                    <span>
                      기업이윤
                      <span className="ml-1 text-[0.62rem] text-primary-900/40">
                        ({((indirect.appliedRates?.profit_rate ?? 0.10) * 100).toFixed(1)}%)
                      </span>
                    </span>
                    <span className="tabular">₩{Math.round(indirect.profit).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary-900 border-t border-primary-200 pt-1.5">
                    <span>공급가액</span>
                    <span className="tabular">₩{Math.round(indirect.supplyAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-primary-900/75">
                    <span>부가가치세 (10%)</span>
                    <span className="tabular">₩{Math.round(indirect.vat).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t-2 border-primary-900 pt-2 mt-1 text-base">
                <span className="font-extrabold text-primary-900">총 견적 금액 (VAT 포함)</span>
                <span className="font-extrabold text-primary-500 tabular">
                  ₩{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[0.65rem] text-amber-900/80 leading-relaxed">
              💡 단가는 KPA 자재 + 대한건설협회 표준품셈 기준. 간접비 요율은 2026 KICT + KPI 표준값 (산안비
              3.11% 법정 최저). 사업자 입찰 시 요율 수정 가능 (산안비 하향 제외).
            </div>
          </>
        )}

        {estimate && sections.length > 0 && (
          <PdfDownloadButton estimate={estimate} segmentation={segmentation} />
        )}

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-full border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
        >
          닫기
        </button>
      </motion.div>
    </>
  );
}

// ──────────────── PDF 다운로드 버튼 (lazy import) ────────────────
function PdfDownloadButton({
  estimate,
  segmentation,
}: {
  estimate: NonNullable<ReturnType<typeof useState<EstimateState>>[0]>;
  segmentation: SegmentationData;
}) {
  const [downloading, setDownloading] = useState(false);
  const [meta, setMeta] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    site_address: "",
  });
  const [showMeta, setShowMeta] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // dynamic import — Vercel 빌드 영향 최소
      const mod = await import("@/lib/inpick/quote-pdf");
      const pyeong = segmentation.real_world_area_sqm
        ? `${Math.round(segmentation.real_world_area_sqm / 3.3)}평`
        : undefined;
      // spec §A-1: 시공자 칸은 입찰 선정 후 자동 주입 — 견적 단계에선 contractor 미전송 (placeholder 표시)
      await mod.downloadQuotePdf(estimate, {
        quote_no: mod.generateQuoteNo(),
        client_name: meta.client_name || "—",
        client_phone: meta.client_phone || undefined,
        client_email: meta.client_email || undefined,
        site_address: meta.site_address || "—",
        site_area_sqm: segmentation.real_world_area_sqm,
        pyeong,
        rooms: undefined,
        validity_days: 30,
        // contractor 미설정 → quote-pdf의 placeholder 박스 자동 표시
      });
    } catch (e) {
      alert("PDF 생성 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* 발주자/현장 정보 입력 (선택) */}
      {showMeta && (
        <div className="mt-4 space-y-2 rounded-lg border border-primary-200 bg-primary-50/30 p-3">
          <p className="text-[0.7rem] font-bold text-primary-900/70">PDF 갑지에 들어갈 정보 (선택)</p>
          <input
            type="text"
            placeholder="발주자 성명 (예: 홍길동)"
            value={meta.client_name}
            onChange={(e) => setMeta({ ...meta, client_name: e.target.value })}
            className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs outline-none focus:border-primary-400"
          />
          <input
            type="text"
            placeholder="연락처"
            value={meta.client_phone}
            onChange={(e) => setMeta({ ...meta, client_phone: e.target.value })}
            className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs outline-none focus:border-primary-400"
          />
          <input
            type="email"
            placeholder="이메일 (선택)"
            value={meta.client_email}
            onChange={(e) => setMeta({ ...meta, client_email: e.target.value })}
            className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs outline-none focus:border-primary-400"
          />
          <input
            type="text"
            placeholder="시공 장소 (예: 서울시 강남구 ...)"
            value={meta.site_address}
            onChange={(e) => setMeta({ ...meta, site_address: e.target.value })}
            className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs outline-none focus:border-primary-400"
          />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className="rounded-full border border-primary-200 bg-white px-3 py-2.5 text-xs font-semibold text-primary-900/70 hover:bg-primary-50"
        >
          {showMeta ? "정보 닫기" : "정보 입력"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:opacity-95 disabled:opacity-60"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF 생성 중…
            </>
          ) : (
            <>
              📄 견적서 PDF 다운로드 (A4 가로 · 갑지·총괄표·내역서)
            </>
          )}
        </button>
      </div>
    </>
  );
}

// segmentation-estimate API 응답 — spec §B-2 신규 + 호환 평면 필드 모두 포함.
// PdfDownloadButton + quote-pdf.tsx는 sections/indirectCosts 우선, 없으면 ensureSections/ensureIndirect 폴백.
type QuoteItemUI = {
  itemId: string;
  name: string;
  spec?: string;
  unit: string;
  quantity: number;
  materialCost: number;
  laborCost: number;
  expenseCost: number;
  totalCost: number;
  source: "catalog" | "standard";
  catalogSku?: string;
};

type QuoteSectionUI = {
  sectionId: string;
  sectionNumber: string;
  sectionName: string;
  items: QuoteItemUI[];
  subtotal: {
    materialCost: number;
    laborCost: number;
    expenseCost: number;
    total: number;
  };
};

type IndirectCostsUI = {
  directCost: number;
  setupCost: number;
  safetyCost: number;
  generalManagementCost: number;
  profit: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  modified?: boolean;
  appliedRates?: {
    safety_rate: number;
    general_management_rate: number;
    profit_rate: number;
  };
};

type EstimateState = {
  // 신규 (spec §B-2 — UI는 이 필드 사용)
  sections?: QuoteSectionUI[];
  directCostSubtotal?: number;
  indirectCosts?: IndirectCostsUI;
  totalAmount?: number;
  unmappedCategories?: string[];

  // 호환 (PdfDownloadButton/quote-pdf.tsx의 ensureSections 폴백 + 옛 통합)
  items?: {
    region_id: string;
    category: string;
    label_ko: string;
    material_name: string;
    material_sku: string;
    brand?: string;
    unit: string;
    qty: number;
    material_price: number;
    labor_price: number;
    unit_total: number;
    material_subtotal: number;
    labor_subtotal: number;
    subtotal: number;
  }[];
  material_subtotal?: number;
  labor_subtotal?: number;
  direct_total?: number;
  setup_items?: { id: string; name: string; description?: string; computed_amount: number }[];
  setup_total?: number;
  expenses?: number;
  expenses_ratio?: number;
  management?: number;
  management_ratio?: number;
  safety?: number;
  safety_ratio?: number;
  indirect?: number;
  indirect_ratio?: number;
  total?: number;
  vat_rate?: number;
  vat_separate?: number;

  generated_at: string;
};

// ──────────────── alpha PNG 마스크 빌더 (가이드 §2-1) ────────────────
async function buildAlphaMask(
  w: number,
  h: number,
  regions: SegRegion[],
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // 시작: 전체 불투명 흰색 (보존)
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fillRect(0, 0, w, h);

  // polygon 영역만 alpha=0 으로 (변경)
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  for (const r of regions) {
    ctx.beginPath();
    r.polygon.forEach(([nx, ny], i) => {
      const x = nx * w;
      const y = ny * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  return canvas.toDataURL("image/png");
}

/**
 * SAM polygon (픽셀 좌표) → alpha PNG 마스크.
 * 정규화 polygon이 아니라 native pixel 좌표라 별도 처리.
 */
async function buildAlphaMaskFromPolygon(
  w: number,
  h: number,
  polygon: number[][],
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  ctx.beginPath();
  polygon.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  return canvas.toDataURL("image/png");
}
