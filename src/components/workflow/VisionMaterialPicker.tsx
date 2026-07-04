/* eslint-disable @next/next/no-img-element */
/**
 * VisionMaterialPicker — Vision Material 후보 선택 모달 (Phase 7).
 *
 * 가이드: c:\Users\user\Downloads\inpick-vision-material-estimate-dev-plan-20260510.md §10
 *
 * 흐름:
 *   1. 이미지 + 클릭 좌표 입력 받음 → analyze API 호출
 *   2. 결과 observation별 Top-3 후보 카드 표시
 *   3. 사용자 선택 → material_match_decisions 저장 + onSelect 콜백
 *
 * 신뢰도 UI:
 *   ≥82% — 초록 "높음"
 *   60~82% — 노랑 "확인 필요"
 *   <60% — 회색 "자재 미확정"
 */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X, Check, AlertCircle } from "lucide-react";
import { useVisionMaterials } from "@/hooks/useVisionMaterials";
import type {
  AnalyzedSurface,
  MaterialProductCandidate,
  SurfaceType,
  VisionMaterialAnalyzeRequest,
} from "@/lib/vision-materials/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (candidate: MaterialProductCandidate, observation: AnalyzedSurface) => void;
  request: VisionMaterialAnalyzeRequest | null;
}

export default function VisionMaterialPicker({ open, onClose, onSelect, request }: Props) {
  const { loading, result, error, analyze, selectCandidate, reset } = useVisionMaterials();
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (open && request) {
      void analyze(request);
    }
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.imageUrl, request?.clickedPoint?.x, request?.clickedPoint?.y]);

  const handleSelect = async (
    cand: MaterialProductCandidate,
    obs: AnalyzedSurface,
  ) => {
    if (!obs.observation.id) {
      onSelect?.(cand, obs);
      onClose();
      return;
    }
    setSelecting(true);
    await selectCandidate({
      observationId: obs.observation.id,
      selectedMaterialProductId: cand.materialProductId,
      confidence: cand.confidence,
    });
    setSelecting(false);
    onSelect?.(cand, obs);
    onClose();
  };

  if (!open || typeof document === "undefined") return null;

  // body 포털 — 조상 transform(framer-motion)이 fixed 기준을 바꿔 화면 이탈하는 것 방지
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">자재 후보 선택</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="h-10 w-10 animate-spin text-primary-500 mb-4" />
                <p>이미지에서 자재를 분석 중입니다...</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-bold">분석 실패</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {result && result.observations.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <p>표면 후보를 찾지 못했습니다.</p>
                <p className="text-xs mt-2">다른 영역을 클릭하거나 이미지 품질을 확인하세요.</p>
              </div>
            )}

            {result && result.observations.length > 0 && (
              <div className="space-y-6">
                {result.observations.map((analyzed, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800">
                        {surfaceTypeLabel(analyzed.observation.surfaceType)}
                      </span>
                      <RecommendationBadge status={analyzed.recommendation.status} confidence={analyzed.recommendation.confidence} />
                    </div>
                    {analyzed.candidates.length === 0 ? (
                      <p className="text-sm text-gray-500">후보 없음 — 표준 자재로 처리됩니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {analyzed.candidates.slice(0, 3).map((c) => (
                          <button
                            key={c.materialProductId}
                            type="button"
                            disabled={selecting}
                            onClick={() => handleSelect(c, analyzed)}
                            className="text-left rounded-xl border-2 border-gray-200 hover:border-primary-400 p-3 transition disabled:opacity-50"
                          >
                            {c.imageUrl && (
                              <img
                                src={c.imageUrl}
                                alt={c.productName}
                                className="w-full aspect-square object-cover rounded-lg mb-2 bg-gray-50"
                              />
                            )}
                            <div className="text-xs font-bold text-primary-700 mb-1">
                              {c.brand || "(브랜드 미지정)"}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {c.productName}
                            </div>
                            {c.spec && (
                              <div className="text-xs text-gray-500 truncate">{c.spec}</div>
                            )}
                            <div className="mt-2 flex items-center justify-between text-xs">
                              <span className="font-bold text-gray-900">
                                {c.unitPrice
                                  ? `${c.unitPrice.toLocaleString()}원/${c.unit || "EA"}`
                                  : "단가 미정"}
                              </span>
                              <ConfidenceBadge confidence={c.confidence} />
                            </div>
                            {c.warnings.length > 0 && (
                              <div className="mt-1 text-[0.65rem] text-amber-700">
                                ⚠ {c.warnings[0]}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 leading-relaxed">
            이 자재는 이미지 분석으로 추정한 추천 후보입니다.
            실제 시공 견적에서는 현장 실측, 자재 재고, 시공사 확인에 따라 변경될 수 있습니다.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.82
      ? "bg-emerald-100 text-emerald-800"
      : confidence >= 0.6
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${color}`}>
      {pct}%
    </span>
  );
}

function RecommendationBadge({
  status,
  confidence,
}: {
  status: "confirmed" | "recommended" | "fallback" | "rejected";
  confidence: number;
}) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800">
        <Check className="h-3 w-3" /> 확정 ({Math.round(confidence * 100)}%)
      </span>
    );
  }
  if (status === "recommended") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">
        추천 ({Math.round(confidence * 100)}%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-bold text-gray-600">
      자재 미확정
    </span>
  );
}

function surfaceTypeLabel(t: SurfaceType): string {
  const m: Record<SurfaceType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    tile: "타일",
    cabinet: "수납장",
    countertop: "상판",
    baseboard: "걸레받이",
    door: "도어",
    window: "창호",
    fixture: "설비",
    lighting: "조명",
    sanitary: "위생도기",
    unknown: "기타",
  };
  return m[t] || "기타";
}
