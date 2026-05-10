/**
 * Anthropic Claude SSE streaming 공통 헬퍼.
 *
 * 작성일: 2026-05-10
 * 사용:
 *   - /api/inpick/design-chat/stream
 *   - /api/project/design-ai
 *   - /api/contractor-ai
 *
 * 정책:
 *   - model: claude-sonnet-4-6 (대표 지정)
 *   - SSE 형식: data: {"text": "..."}\n\n  (텍스트 내 \n 안전한 JSON encode)
 *   - 마지막에 data: [DONE]\n\n
 *   - prompt caching: ephemeral 5분 (시스템 프롬프트 토큰 절약 90%)
 *   - 모델 폴백: 없음 (대표 정책 — fallback 금지)
 *
 * 에러 처리:
 *   - 401: 인증 실패 → mock 응답 폴백 (옵션) 또는 502
 *   - 429: rate limit → 502 + retry hint
 *   - 404: 모델 권한 미설정 → 502
 *   - 그 외 → 502 + 일반 에러
 */

import { NextResponse } from "next/server";
import { assertAIProviderAllowed, AIProviderBlockedError } from "./model-registry";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicStreamOptions {
  /** Claude 모델 (default: claude-sonnet-4-6) */
  model?: string;
  /** max_tokens (default: 2048) */
  maxTokens?: number;
  /** temperature (default: 0.7) */
  temperature?: number;
  /** 시스템 프롬프트 (캐시됨 — ephemeral 5분) */
  system: string;
  /** 메시지 (user/assistant 교차) */
  messages: ChatMessage[];
  /** Mock fallback 함수 (Anthropic 호출 실패 시) */
  mockFallback?: (messages: ChatMessage[]) => string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Anthropic Claude SSE stream → JSON-encoded SSE 응답.
 * 클라이언트는 data: {text} JSON parse → acc 누적.
 */
export async function streamAnthropicChat(
  opts: AnthropicStreamOptions,
): Promise<Response> {
  // 정책 — anthropic provider 허용 여부
  try {
    assertAIProviderAllowed("anthropic");
  } catch (e) {
    if (e instanceof AIProviderBlockedError) {
      return NextResponse.json(
        { error: "AI_PROVIDER_BLOCKED", hint: e.message },
        { status: 501 },
      );
    }
    throw e;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Mock fallback or error
    if (opts.mockFallback) {
      return mockSSEResponse(opts.mockFallback(opts.messages));
    }
    return NextResponse.json(
      {
        error: "AI 서비스 미설정",
        hint: "ANTHROPIC_API_KEY 환경변수 등록 + Redeploy 필요",
      },
      { status: 503 },
    );
  }

  const model = opts.model || DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        system: [
          {
            type: "text",
            text: opts.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        stream: true,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (e) {
    console.warn(
      `[anthropic-stream] network error: ${e instanceof Error ? e.message : String(e)}`,
    );
    if (opts.mockFallback) {
      return mockSSEResponse(opts.mockFallback(opts.messages));
    }
    return NextResponse.json(
      { error: "AI 서비스 통신 실패", hint: "잠시 후 재시도해주세요" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.warn(
      `[anthropic-stream] upstream ${upstream.status}: ${errText.slice(0, 200)}`,
    );
    let hint = "AI 응답 실패";
    if (upstream.status === 401) hint = "AI 인증 실패 (관리자 문의)";
    else if (upstream.status === 429) hint = "요청이 많습니다 — 잠시 후 재시도";
    else if (upstream.status === 404 || errText.includes("model_not_found")) {
      hint = `모델 권한 미설정 (${model})`;
    }
    if (opts.mockFallback) {
      return mockSSEResponse(opts.mockFallback(opts.messages));
    }
    return NextResponse.json({ error: "AI 응답 실패", hint }, { status: 502 });
  }

  // Anthropic SSE → 클라이언트 JSON-encoded SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const j = JSON.parse(data) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
                const txt = j.delta.text || "";
                if (txt) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: txt })}\n\n`),
                  );
                }
              }
              if (j.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              /* ping/keep-alive 등 비-JSON 무시 */
            }
          }
        }
      } catch (e) {
        console.warn(
          `[anthropic-stream] read error: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Mock fallback SSE 응답 (Anthropic 미설정/실패 시 데모용).
 * 텍스트를 20자씩 끊어서 streaming.
 */
export function mockSSEResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const chunkSize = 20;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
        );
        await new Promise((r) => setTimeout(r, 20));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
