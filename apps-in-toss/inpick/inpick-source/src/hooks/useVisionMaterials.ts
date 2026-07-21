/**
 * useVisionMaterials — vision-materials/analyze API 클라이언트 hook (Phase 7).
 *
 * 사용:
 *   const { analyze, loading, result, error } = useVisionMaterials();
 *   await analyze({ projectId, imageUrl, sourceImageKind: "ai_render", clickedPoint, roomType });
 */
"use client";

import { useState, useCallback } from "react";
import type {
  VisionMaterialAnalyzeRequest,
  VisionMaterialAnalyzeResult,
} from "@/lib/vision-materials/types";

export interface UseVisionMaterialsState {
  loading: boolean;
  result: VisionMaterialAnalyzeResult | null;
  error: string | null;
}

export function useVisionMaterials() {
  const [state, setState] = useState<UseVisionMaterialsState>({
    loading: false,
    result: null,
    error: null,
  });

  const analyze = useCallback(async (req: VisionMaterialAnalyzeRequest) => {
    setState({ loading: true, result: null, error: null });
    try {
      const res = await fetch("/api/inpick/vision-materials/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = (await res.json()) as VisionMaterialAnalyzeResult & {
        error?: string;
        hint?: string;
      };
      if (!res.ok || data.error) {
        const msg = data.error || `HTTP ${res.status}`;
        setState({ loading: false, result: null, error: msg });
        return null;
      }
      setState({ loading: false, result: data, error: null });
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ loading: false, result: null, error: msg });
      return null;
    }
  }, []);

  /** 사용자가 후보를 선택했을 때 — material_match_decisions 저장 */
  const selectCandidate = useCallback(
    async (input: {
      observationId: string;
      selectedMaterialProductId: string;
      confidence: number;
    }) => {
      const res = await fetch("/api/inpick/vision-materials/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observationId: input.observationId,
          selectedMaterialProductId: input.selectedMaterialProductId,
          decisionType: "user_selected",
          confidence: input.confidence,
        }),
      });
      const data = (await res.json()) as { decisionId?: string; ok?: boolean };
      return data;
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, analyze, selectCandidate, reset };
}
