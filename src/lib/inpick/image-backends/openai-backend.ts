/**
 * OpenAI image generation backend — 기존 openai-client.ts wrapper.
 *
 * 가이드: 기존 openai-client.ts를 삭제하지 말고 wrapper로 유지 (fallback).
 *
 * 책임:
 *   - RenderRoomRequest → openai-client RenderRoomInput 변환
 *   - generateRoomRender 호출 결과 → RenderRoomResult 변환
 *   - 에러 상태 분류 (billing/auth/rate_limited 등)
 */

import {
  generateRoomRender,
  type RenderRoomInput as OpenAIRenderInput,
} from "@/lib/inpick/openai-client";
import { hasOpenAIKey } from "@/lib/inpick/openai-env";
import { assertModelAllowedForRuntime } from "./model-policy";
import type {
  ImageGenerationBackend,
  RenderRoomRequest,
  RenderRoomResult,
} from "./types";

const DEFAULT_MODEL_ID = "openai/gpt-image-2";

export class OpenAIBackend implements ImageGenerationBackend {
  readonly name = "openai" as const;

  async renderRoom(input: RenderRoomRequest): Promise<RenderRoomResult> {
    const t0 = Date.now();

    // ─── 1. 환경 검증 ───
    if (!hasOpenAIKey()) {
      return {
        backend: "openai",
        model: DEFAULT_MODEL_ID,
        status: "failed",
        error: "OpenAI API key 미설정",
        hint: "Vercel/.env.local에 OPENAI_API_KEY 등록",
        modelStatus: "auth",
        elapsedMs: Date.now() - t0,
      };
    }

    // ─── 2. 모델 정책 검증 (production guard) ───
    try {
      assertModelAllowedForRuntime(DEFAULT_MODEL_ID);
    } catch (e) {
      return {
        backend: "openai",
        model: DEFAULT_MODEL_ID,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
        modelStatus: "blocked",
        elapsedMs: Date.now() - t0,
      };
    }

    // ─── 3. RenderRoomRequest → OpenAIRenderInput 변환 ───
    const openaiInput: OpenAIRenderInput = {
      roomName: input.roomName,
      widthMm: input.widthMm ?? 4500,
      depthMm: input.depthMm ?? 4000,
      heightMm: input.heightMm ?? 2400,
      style: input.stylePreset || input.prompt || "modern minimal",
      expansion: input.expansion,
      size: input.size,
      windows: input.windows,
      doors: input.doors,
      windowWalls: input.windowWalls,
      doorWalls: input.doorWalls,
      adjacentRooms: input.adjacentRooms,
      isInteriorRoom: input.isInteriorRoom,
      furnishingOptions: input.furnishingOptions,
      aspectRatio: input.aspectRatio,
      isFromFloorplan: input.isFromFloorplan,
      previousReference: input.previousReference,
      floorplanImageUrl: input.floorplanImageUrl,
      quality: input.quality === "draft" ? "low" : input.quality === "standard" ? "medium" : input.quality === "high" ? "high" : input.quality,
      wallLayout: input.wallLayout,
    };

    // ─── 4. 호출 ───
    try {
      const result = await generateRoomRender(openaiInput);
      return {
        imageUrl: result.imageUrl,
        imageBase64: result.imageBase64,
        revisedPrompt: result.revisedPrompt,
        status: "completed",
        backend: "openai",
        model: result.model || DEFAULT_MODEL_ID,
        costUsd: result.costUsd,
        elapsedMs: Date.now() - t0,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      let modelStatus: RenderRoomResult["modelStatus"] = "unknown";
      let hint: string | undefined;

      if (lower.includes("incorrect api key") || lower.includes("invalid_api_key") || lower.includes("401")) {
        modelStatus = "auth";
        hint = "OpenAI API 키 인증 실패 — 관리자에게 문의";
      } else if (lower.includes("billing") || lower.includes("quota") || lower.includes("insufficient")) {
        modelStatus = "billing";
        hint = "OpenAI 결제 한도 초과 — Project Limits 확인";
      } else if (
        lower.includes("model_not_found") ||
        lower.includes("does not have access") ||
        lower.includes("404")
      ) {
        modelStatus = "blocked";
        hint = "OpenAI 모델 사용 권한 미설정";
      } else if (lower.includes("rate limit") || lower.includes("429")) {
        modelStatus = "rate_limited";
        hint = "OpenAI rate limit 초과 — 잠시 후 재시도";
      } else if (lower.includes("시간 초과") || lower.includes("timeout") || lower.includes("abort")) {
        modelStatus = "timeout";
        hint = "OpenAI 응답 지연 — 잠시 후 재시도";
      }

      return {
        backend: "openai",
        model: DEFAULT_MODEL_ID,
        status: "failed",
        error: msg,
        hint,
        modelStatus,
        elapsedMs: Date.now() - t0,
      };
    }
  }
}

/** Singleton — 매 호출마다 새 인스턴스 생성 불필요 */
let _instance: OpenAIBackend | null = null;
export function getOpenAIBackend(): OpenAIBackend {
  if (!_instance) _instance = new OpenAIBackend();
  return _instance;
}
