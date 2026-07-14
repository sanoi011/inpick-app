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

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Eye, Crosshair, Plus, Minus, ChevronRight, RotateCcw, ScanLine, ShieldCheck } from "lucide-react";
import { useSamClient, type SamPolygonResult, type SamPoint } from "@/hooks/useSamClient";
import {
  SAM_SURFACE_TARGETS,
  type SamSurfaceTarget,
} from "@/lib/inpick/sam-surface-prompts";

interface Props {
  /** 분할 대상 이미지 URL */
  imageUrl: string;
  /** 사용자가 영역 확정 시 호출 — 자재 선택 모달 등 */
  onConfirm?: (region: SamPolygonResult, targetSurface: SamSurfaceTarget) => void;
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

/**
 * SAM 마스크는 흑백 PNG라 alpha 채널이 이미지 전체에 존재한다.
 * luminance를 실제 alpha로 바꿔 검정 배경은 투명하게 만들고,
 * 선택 영역 내부는 옅게, 실제 경계만 선명하게 표시한다.
 */
function RasterMaskOverlay({ maskUrl }: { maskUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mask = new Image();
    mask.crossOrigin = "anonymous";
    mask.onload = () => {
      if (cancelled || !canvasRef.current) return;
      try {
        const scale = Math.min(1, 1400 / Math.max(1, mask.naturalWidth));
        const width = Math.max(1, Math.round(mask.naturalWidth * scale));
        const height = Math.max(1, Math.round(mask.naturalHeight * scale));
        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("canvas context unavailable");
        context.drawImage(mask, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const source = new Uint8ClampedArray(image.data);
        const selectedAt = (index: number) =>
          source[index] + source[index + 1] + source[index + 2] >= 384;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            if (!selectedAt(index)) {
              image.data[index + 3] = 0;
              continue;
            }
            const edge =
              x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
              !selectedAt(index - 4) || !selectedAt(index + 4) ||
              !selectedAt(index - width * 4) || !selectedAt(index + width * 4);
            image.data[index] = 241;
            image.data[index + 1] = 91;
            image.data[index + 2] = 74;
            image.data[index + 3] = edge ? 235 : 58;
          }
        }
        context.putImageData(image, 0, 0);
      } catch {
        if (!cancelled) setFallback(true);
      }
    };
    mask.onerror = () => {
      if (!cancelled) setFallback(true);
    };
    mask.src = maskUrl;
    return () => {
      cancelled = true;
    };
  }, [maskUrl]);

  if (fallback) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#f15b4a]/25"
        style={{
          maskImage: "url(" + maskUrl + ")",
          maskMode: "luminance",
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        }}
      />
    );
  }
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

export default function ClickableRenderImage({
  imageUrl,
  onConfirm,
  initialMode = "view",
  hint,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [targetSurface, setTargetSurface] = useState<SamSurfaceTarget>("floor");
  const [selected, setSelected] = useState<SamPolygonResult | null>(null);
  const [candidateOptions, setCandidateOptions] = useState<SamPolygonResult[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [recommendedCandidateIndex, setRecommendedCandidateIndex] = useState(0);
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
      setCandidateOptions([]);
      setCandidateIndex(0);
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
      targetSurface,
    });
    if (result) {
      const candidates = (result.candidates || [])
        .map((candidate) => ({ ...candidate, image_size: result.image_size }))
        .sort((a, b) => a.area_pixels - b.area_pixels);
      const options = candidates.length > 0 ? candidates : [result];
      const topScored = Math.max(
        0,
        options.findIndex(
          (option) =>
            option.area_pixels === result.area_pixels &&
            Math.abs(option.confidence - result.confidence) < 0.0001,
        ),
      );
      const imageArea = Math.max(1, result.image_size[0] * result.image_size[1]);
      const reasonable = options
        .map((option, index) => ({
          option,
          index,
          ratio: option.area_pixels / imageArea,
        }))
        .filter(({ ratio }) => ratio >= 0.005 && ratio <= 0.82)
        .sort((a, b) => b.option.confidence - a.option.confidence);
      const recommended = reasonable[0]?.index ?? topScored;
      setCandidateOptions(options);
      setCandidateIndex(recommended);
      setRecommendedCandidateIndex(recommended);
      setSelected(options[recommended]);
      setRefinePoints({ positive: [point], negative: [] });
    }
  };

  const handleReset = () => {
    setSelected(null);
    setCandidateOptions([]);
    setCandidateIndex(0);
    setRecommendedCandidateIndex(0);
    setRefinePoints({ positive: [], negative: [] });
    sam.click.reset();
    sam.refine.reset();
  };

  const handleConfirm = () => {
    if (selected && onConfirm) onConfirm(selected, targetSurface);
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

      {mode === "select" && (
        <div className="rounded-2xl border border-black/[0.08] bg-[#f7f7f5] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-black">먼저 바꿀 부위를 고르세요</p>
              <p className="mt-0.5 text-[0.68rem] text-black/50">
                부위 이름과 클릭 위치를 함께 분석해 경계를 찾습니다.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-black/10 bg-white px-2 py-1 text-[0.62rem] font-semibold text-black/55">
              의미 + 위치 분석
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {(Object.entries(SAM_SURFACE_TARGETS) as Array<
              [SamSurfaceTarget, (typeof SAM_SURFACE_TARGETS)[SamSurfaceTarget]]
            >).map(([value, config]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (value !== targetSurface) handleReset();
                  setTargetSurface(value);
                  setMode("select");
                }}
                className={`rounded-full border px-2.5 py-2 text-xs font-bold transition-colors ${
                  targetSurface === value
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/65 hover:border-black/30"
                }`}
              >
                {config.labelKo}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      {mode === "select" && !selected && (
        <div className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs leading-relaxed text-black/70">
          사진에서 <strong className="text-black">{SAM_SURFACE_TARGETS[targetSurface].labelKo}</strong> 영역 안쪽을 클릭하세요.
          {hint && <span className="mt-1 block text-black/45">{hint}</span>}
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
            {!selected.mask_url && (
              <polygon
                points={selected.polygon.map((p) => p.join(",")).join(" ")}
                fill="rgba(247, 59, 32, 0.30)"
                stroke="#F73B20"
                strokeWidth={Math.max(2, imageNatural.w / 200)}
                vectorEffect="non-scaling-stroke"
              />
            )}
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

        {/* polygon 근사치가 아닌 SAM 원본 raster mask로 정확한 선택 경계를 표시 */}
        {selected?.mask_url && <RasterMaskOverlay maskUrl={selected.mask_url} />}

        {mode === "select" && !selected && !loading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-primary-500 to-transparent shadow-[0_0_14px_rgba(247,59,32,0.8)]" />
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
                <p className="mt-2 text-sm font-bold text-black">{SAM_SURFACE_TARGETS[targetSurface].labelKo} 경계 분석 중…</p>
                <p className="text-[0.65rem] text-black/50">
                  의미 분석 후 클릭 위치로 범위를 좁히고 있습니다
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 신뢰도 뱃지 */}
        {selected && !loading && (
          <div className="absolute top-2 right-2 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[0.65rem] font-bold text-black shadow-sm backdrop-blur inline-flex items-center gap-1">
            {selected.engine === "sam3" ? "의미 선택" : "정밀 선택"} · 신뢰도 {Math.round(selected.confidence * 100)}%
          </div>
        )}
      </div>

      {/* SAM 다중 마스크 후보 — 좁게/추천/넓게를 직접 보고 선택 */}
      {selected && candidateOptions.length > 1 && !loading && (
        <div className="rounded-xl border border-primary-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-3.5 w-3.5 text-primary-500" />
            <p className="text-xs font-bold text-primary-900">선택 경계 비교</p>
            <span className="text-[0.65rem] text-primary-900/50">가장 정확한 범위를 고르세요</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {candidateOptions.map((candidate, index) => {
              const labels = candidateOptions.length === 3
                ? ["좁게", "중간", "넓게"]
                : candidateOptions.map((_, i) => `후보 ${i + 1}`);
              return (
                <button
                  key={`${candidate.area_pixels}-${index}`}
                  type="button"
                  onClick={() => {
                    setCandidateIndex(index);
                    setSelected(candidate);
                  }}
                  className={`rounded-lg border px-2 py-2 text-[0.7rem] font-bold transition ${
                    candidateIndex === index
                      ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                      : "border-primary-100 text-primary-900/60 hover:border-primary-300"
                  }`}
                >
                  {labels[index]}{index === recommendedCandidateIndex ? " · 추천" : ""}
                  <span className="mt-0.5 block text-[0.58rem] font-medium opacity-60">
                    {((candidate.area_pixels / Math.max(1, imageNatural!.w * imageNatural!.h)) * 100).toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && !loading && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            imageNatural && selected.area_pixels / Math.max(1, imageNatural.w * imageNatural.h) > 0.82
              ? "border-black/15 bg-[#f7f7f5] text-black"
              : "border-black/10 bg-white text-black"
          }`}
        >
          <p className="inline-flex items-center gap-1.5 font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            {imageNatural && selected.area_pixels / Math.max(1, imageNatural.w * imageNatural.h) > 0.82
              ? "선택 범위가 너무 넓습니다"
              : `${SAM_SURFACE_TARGETS[targetSurface].labelKo} 경계 안쪽만 변경됩니다`}
          </p>
          <p className="mt-1 text-[0.68rem] opacity-75">
            다른 부위가 포함됐다면 <strong>제외</strong>를 누르고 잘못 포함된 곳을 찍으세요. 빠진 곳은 <strong>추가</strong>로 보정할 수 있습니다.
          </p>
        </div>
      )}

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
              선택 경계 확인 · 자재 고르기
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
