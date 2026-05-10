/**
 * GET /api/inpick/health
 *
 * 외부 의존성 진단 — 실제 OpenAI API에 핑을 쳐서 키 유효성 확인.
 */
import { NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/inpick/openai-env";
import { getAIEnvStatus, getActivePolicy } from "@/lib/ai/model-registry";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

async function pingOpenAI(key: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    // /v1/models 가 가장 가벼운 인증 체크
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: 200 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const openaiKey = getOpenAIKey();
  const forceMock = process.env.INPICK_FORCE_MOCK_RENDER === "true";
  // 어떤 변수명에서 발견됐는지 표시 (디버깅용)
  const keySource =
    process.env.OPENAI_API_KEY
      ? "OPENAI_API_KEY"
      : process.env.openai_api_key
        ? "openai_api_key (소문자)"
        : process.env.OPENAI_KEY
          ? "OPENAI_KEY"
          : null;

  let openaiPing: { ok: boolean; status?: number; error?: string } = { ok: false };
  if (openaiKey) {
    openaiPing = await pingOpenAI(openaiKey);
  }

  const aiEnv = getAIEnvStatus();

  return NextResponse.json({
    aiPolicy: {
      active: getActivePolicy(),
      required: aiEnv.required,
      optional: aiEnv.optional,
      deprecated: aiEnv.deprecated, // GOOGLE_GEMINI_API_KEY 표시
    },
    openai: {
      configured: !!openaiKey,
      keySource,
      keyHint: openaiKey ? `sk-...${openaiKey.slice(-4)}` : null,
      keyLength: openaiKey?.length ?? 0,
      forceMock,
      ping: openaiPing,
      mode: openaiKey && openaiPing.ok && !forceMock ? "live" : "broken",
    },
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      keyHint: process.env.ANTHROPIC_API_KEY
        ? `sk-ant-...${process.env.ANTHROPIC_API_KEY.slice(-4)}`
        : null,
    },
    runpod: {
      configured: !!process.env.RUNPOD_API_KEY,
      endpoints: {
        flux: !!process.env.RUNPOD_FLUX_ENDPOINT,
        sync: !!process.env.RUNPOD_SYNC_ENDPOINT,
        async: !!process.env.RUNPOD_ASYNC_ENDPOINT,
      },
    },
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    timestamp: new Date().toISOString(),
  });
}
