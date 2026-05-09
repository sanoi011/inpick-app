/* eslint-disable @next/next/no-img-element */
/**
 * ClickableRenderImage — 가이드(InPick_STEP02_Workflow.md §3-4) 동등 구현.
 *
 * 흐름:
 *   1. 이미지 표시 + "view" / "select" 모드 토글
 *   2. select 모드: cursor crosshair, 사용자가 이미지의 한 점 클릭
 *   3. 클릭 좌표 → 이미지 픽셀 좌표 변환 → /api/inpick/sam/click 호출 (useSamClient)
 *   4. 응답 polygon → SVG <polygon> overlay (오렌지 하이라이트)
 *   5. refine 모드 (선택): 추가 클릭으로 +(포함) / -(제외) 점 누적
 *   6. "이 부위 자재 바꾸기" 버튼 → onConfirm callback 호출
 *
 * 호출처: MaterialEditor 또는 Step2Designer 안에 임베드.
 */
"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Eye, Crosshair, Plus, Minus, ChevronRight, RotateCcw } from "lucide-react";
import { useSamClient, type SamPolygonResult, type SamPoint } from "@/hooks/useSamClient";

interface Props {
  /** 분할 대상 이미지 URL */
  imageUrl: string;
  /** 사용자가 영역 확정 시 호출 — 자재 선택 모달 등 */
  onConfirm?: (region: SamPolygonResult) => void;
  /** 모달이 외부에서 강제로 view 모드로 돌릴 때 */
  initialMode?: "view" | "select";
  /** 추가 안내 텍스트 */
  hint?: string;
}

type Mode = "view" | "select";

interface RefinePoints {
  positive: SamPoint[];
  negative: SamPoint[];
}

export default function ClickableRenderImage({
  imageUrl,
  onConfirm,
  initialMode = "view",
  hint,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selected, setSelected] = useState<SamPolygonResult | null>(null);
  const [refinePoints, setRefinePoints] = useState<RefinePoints>({ positive: [], negative: [] });
  const [refineMode, setRefineMode] = useState<"add" | "remove">("add");
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const sam = useSamClient();
  const loading = sam.click.status === "loading" || sam.refine.status === "loading";

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  /** display 좌표 → 이미지 native 픽셀 좌표 변환 */
  const screenToImagePixel = useCallback(
    (e: React.MouseEvent<HTMLImageElement>): SamPoint => {
      const rect = e.currentTarget.getBoundingClientRect();
      const natural = imageNatural || { w: 1024, h: 1024 };
      const scaleX = natural.w / rect.width;
      const scaleY = natural.h / rect.height;
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
      };
    },
    [imageNatural],
  );

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (mode !== "select" || loading) return;
    const point = screenToImagePixel(e);

    // refine 모드 — 기존 polygon이 있는 상태에서 점 누적
    if (selected) {
      const nextRefine: RefinePoints = {
        positive:
          refineMode === "add"
            ? [...refinePoints.positive, point]
            : refinePoints.positive,
        negative:
          refineMode === "remove"
            ? [...refinePoints.negative, point]
            : refinePoints.negative,
      };
      setRefinePoints(nextRefine);
      const result = await sam.refine.call({
        imageUrl,
        positive: nextRefine.positive,
        negative: nextRefine.negative,
      });
      if (result) setSelected(result);
      return;
    }

    // 첫 클릭 — click_segment
    sam.click.reset();
    const result = await sam.click.call({
      imageUrl,
      x: point.x,
      y: point.y,
    });
    if (result) {
      setSelected(result);
      setRefinePoints({ positive: [point], negative: [] });
    }
  };

  const handleReset = () => {
    setSelected(null);
    setRefinePoints({ positive: [], negative: [] });
    sam.click.reset();
    sam.refine.reset();
  };

  const handleConfirm = () => {
    if (selected && onConfirm) onConfirm(selected);
  };

  // SVG viewBox는 native 픽셀 기준 — preserveAspectRatio: none으로 displayed 영역에 정확 매핑
  const viewBox = imageNatural
    ? `0 0 ${imageNatural.w} ${imageNatural.h}`
    : "0 0 1024 1024";

  return (
    <div className="space-y-3">
      {/* 모드 토글 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-primary-200 bg-white p-0.5 text-[0.7rem] font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("view");
              handleReset();
            }}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition-colors ${
              mode === "view"
                ? "bg-primary-500 text-white"
                : "text-primary-900/60 hover:text-primary-900"
            }`}
          >
            <Eye className="h-3 w-3" /> 보기
          </button>
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition-colors ${
              mode === "select"
                ? "bg-primary-500 text-white"
                : "text-primary-900/60 hover:text-primary-900"
            }`}
          >
            <Crosshair className="h-3 w-3" /> 부위 선택
          </button>
        </div>

        {/* refine 모드 +/- 토글 (selected 있을 때만) */}
        {mode === "select" && selected && (
          <div className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 p-0.5 text-[0.65rem] font-bold">
            <button
              type="button"
              onClick={() => setRefineMode("add")}
              className={`px-2 py-1 rounded-full inline-flex items-center gap-0.5 transition-colors ${
                refineMode === "add"
                  ? "bg-emerald-500 text-white"
                  : "text-amber-700 hover:text-amber-900"
              }`}
              title="포함할 점"
            >
              <Plus className="h-2.5 w-2.5" /> 추가
            </button>
            <button
              type="button"
              onClick={() => setRefineMode("remove")}
              className={`px-2 py-1 rounded-full inline-flex items-center gap-0.5 transition-colors ${
                refineMode === "remove"
                  ? "bg-red-500 text-white"
                  : "text-amber-700 hover:text-amber-900"
              }`}
              title="제외할 점"
            >
              <Minus className="h-2.5 w-2.5" /> 제외
            </button>
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      {mode === "select" && !selected && (
        <div className="rounded-lg bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-900 leading-relaxed">
          💡 바꾸고 싶은 부분(예: 안방 문짝, 거실 벽지, 바닥)을 클릭하세요. AI가 그 영역만 정확히 분할합니다.
          {hint && <span className="block mt-1 text-primary-900/60">{hint}</span>}
        </div>
      )}

      {/* 이미지 + SVG overlay */}
      <div className="relative w-full rounded-xl border border-primary-200 overflow-hidden bg-white">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="design"
          onLoad={handleImageLoad}
          onClick={handleImageClick}
          draggable={false}
          className="block w-full select-none"
          style={{
            cursor: mode === "select" && !loading ? "crosshair" : "default",
          }}
        />

        {/* polygon overlay */}
        {selected && imageNatural && (
          <svg
            viewBox={viewBox}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <polygon
              points={selected.polygon.map((p) => p.join(",")).join(" ")}
              fill="rgba(247, 59, 32, 0.30)"
              stroke="#F73B20"
              strokeWidth={Math.max(2, imageNatural.w / 200)}
              vectorEffect="non-scaling-stroke"
            />
            {/* refine 점들 */}
            {refinePoints.positive.map((p, i) => (
              <circle
                key={`pos-${i}`}
                cx={p.x}
                cy={p.y}
                r={Math.max(4, imageNatural.w / 100)}
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth={Math.max(1, imageNatural.w / 300)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {refinePoints.negative.map((p, i) => (
              <circle
                key={`neg-${i}`}
                cx={p.x}
                cy={p.y}
                r={Math.max(4, imageNatural.w / 100)}
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth={Math.max(1, imageNatural.w / 300)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {/* 로딩 오버레이 */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="text-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary-500 mx-auto" />
                <p className="mt-2 text-sm font-bold text-primary-900">영역 분석 중…</p>
                <p className="text-[0.65rem] text-primary-900/60">
                  첫 호출 시 cold start 30~60초
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 신뢰도 뱃지 */}
        {selected && !loading && (
          <div className="absolute top-2 right-2 rounded-full bg-white/90 backdrop-blur border border-primary-200 px-2.5 py-1 text-[0.65rem] font-bold text-primary-900 shadow inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            신뢰도 {Math.round(selected.confidence * 100)}%
          </div>
        )}
      </div>

      {/* 에러 */}
      {(sam.click.error || sam.refine.error) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 whitespace-pre-wrap">
          {sam.click.error || sam.refine.error}
        </div>
      )}

      {/* 액션 버튼 (selected 있을 때) */}
      {selected && !loading && mode === "select" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-900/70 hover:bg-primary-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            다시 선택
          </button>
          {onConfirm && (
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta hover:bg-primary-600"
            >
              이 부위 자재 바꾸기
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
