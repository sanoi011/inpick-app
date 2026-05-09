/**
 * 클라이언트 측 SAM 2.1 API 호출 hook.
 *
 * 가이드(InPick_RunPod_Serverless_Migration.md §3) 동등 — 프론트엔드에서
 * /api/inpick/sam/* 호출 + 진행 상태 + 에러 처리.
 *
 * Vercel API → RunPod Serverless → SAM 2.1 (L40S 또는 24GB GPU).
 */
"use client";

import { useCallback, useState } from "react";

export interface SamPolygonResult {
  polygon: number[][]; // [[x, y], ...] (픽셀 좌표)
  confidence: number;
  area_pixels: number;
  image_size: [number, number];
  mask_url: string | null; // Supabase Storage public URL (자재 교체 시 재사용)
}

export interface SamAutoRegion {
  id: string;
  polygon: number[][];
  bbox: number[];
  area_pixels: number;
  mask_url: string | null;
}

export interface SamAutoResult {
  regions: SamAutoRegion[];
  image_size: [number, number];
  pixel_to_sqm_ratio?: number;
  total_regions: number;
}

export interface SamPoint {
  x: number;
  y: number;
}

export type SamCallStatus = "idle" | "loading" | "ok" | "error";

interface CallState<T> {
  status: SamCallStatus;
  data: T | null;
  error: string | null;
  hint: string | null;
}

const initial = <T>(): CallState<T> => ({ status: "idle", data: null, error: null, hint: null });

interface FetchError {
  error?: string;
  hint?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T | FetchError;
  if (!res.ok) {
    const e = data as FetchError;
    const msg = e.error || `HTTP ${res.status}`;
    const hint = e.hint;
    const err = new Error(msg + (hint ? `\n→ ${hint}` : ""));
    (err as Error & { hint?: string }).hint = hint;
    throw err;
  }
  return data as T;
}

export function useSamClient() {
  const [click, setClick] = useState<CallState<SamPolygonResult>>(initial());
  const [refine, setRefine] = useState<CallState<SamPolygonResult>>(initial());
  const [auto, setAuto] = useState<CallState<SamAutoResult>>(initial());

  /**
   * 클릭 좌표 기반 단일 영역 분할.
   * 일반적으로 1~3초 (cold start 시 30~60초).
   */
  const callClick = useCallback(
    async (input: { imageUrl: string; x: number; y: number }): Promise<SamPolygonResult | null> => {
      setClick({ status: "loading", data: null, error: null, hint: null });
      try {
        const data = await postJson<SamPolygonResult>("/api/inpick/sam/click", input);
        setClick({ status: "ok", data, error: null, hint: null });
        return data;
      } catch (e) {
        const err = e as Error & { hint?: string };
        setClick({
          status: "error",
          data: null,
          error: err.message,
          hint: err.hint || null,
        });
        return null;
      }
    },
    [],
  );

  /**
   * 영역 미세 조정 — positive(포함할 점) + negative(제외할 점).
   */
  const callRefine = useCallback(
    async (input: {
      imageUrl: string;
      positive: SamPoint[];
      negative: SamPoint[];
    }): Promise<SamPolygonResult | null> => {
      setRefine({ status: "loading", data: null, error: null, hint: null });
      try {
        const data = await postJson<SamPolygonResult>("/api/inpick/sam/refine", input);
        setRefine({ status: "ok", data, error: null, hint: null });
        return data;
      } catch (e) {
        const err = e as Error & { hint?: string };
        setRefine({
          status: "error",
          data: null,
          error: err.message,
          hint: err.hint || null,
        });
        return null;
      }
    },
    [],
  );

  /**
   * 이미지 전체 자동 분할.
   * 5~15초 (cold start 시 30~60초).
   */
  const callAutoSegment = useCallback(
    async (input: { imageUrl: string; realWorldAreaSqm?: number }): Promise<SamAutoResult | null> => {
      setAuto({ status: "loading", data: null, error: null, hint: null });
      try {
        const data = await postJson<SamAutoResult>("/api/inpick/sam/auto-segment", input);
        setAuto({ status: "ok", data, error: null, hint: null });
        return data;
      } catch (e) {
        const err = e as Error & { hint?: string };
        setAuto({
          status: "error",
          data: null,
          error: err.message,
          hint: err.hint || null,
        });
        return null;
      }
    },
    [],
  );

  /**
   * 워커 cold start 회피용. Step2 진입 시 호출.
   * 응답 대기 안 함 — fire-and-forget.
   */
  const callWarmup = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/inpick/sam/warmup", { method: "POST" });
    } catch {
      /* warmup 실패는 사용자 차단 X */
    }
  }, []);

  const resetClick = useCallback(() => setClick(initial()), []);
  const resetRefine = useCallback(() => setRefine(initial()), []);
  const resetAuto = useCallback(() => setAuto(initial()), []);

  return {
    click: { ...click, call: callClick, reset: resetClick },
    refine: { ...refine, call: callRefine, reset: resetRefine },
    auto: { ...auto, call: callAutoSegment, reset: resetAuto },
    warmup: callWarmup,
  };
}
