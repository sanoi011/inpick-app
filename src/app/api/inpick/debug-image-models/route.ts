/**
 * GET /api/inpick/debug-image-models
 *
 * gpt-image-1 / gpt-image-2 / dall-e-3 / dall-e-2 각각 호출해서
 * 어떤 모델이 작동하고 어떤 에러가 떨어지는지 진단.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/inpick/openai-env";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OPENAI_BASE = "https://api.openai.com/v1";

async function tryModel(
  apiKey: string,
  model: string,
  payload: Record<string, unknown>,
): Promise<{
  model: string;
  status: number;
  ok: boolean;
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
  rawSnippet?: string;
}> {
  try {
    const res = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, model }),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not json */
    }
    type OAIError = {
      type?: string;
      code?: string;
      message?: string;
    };
    const errBlock = parsed && typeof parsed === "object" && "error" in parsed
      ? (parsed as { error?: OAIError }).error
      : undefined;
    return {
      model,
      status: res.status,
      ok: res.ok,
      errorType: errBlock?.type,
      errorCode: errBlock?.code,
      errorMessage: errBlock?.message,
      rawSnippet: !res.ok ? text.slice(0, 400) : undefined,
    };
  } catch (e) {
    return {
      model,
      status: 0,
      ok: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(req: NextRequest) {
  // 유료 이미지 4건/호출 발생 — 관리자 전용 (운영 노출·어뷰징 차단)
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const key = getOpenAIKey();
  if (!key) {
    return NextResponse.json({ error: "OpenAI 키 미설정" }, { status: 500 });
  }

  const tinyPrompt = "test";
  const results = await Promise.all([
    tryModel(key, "gpt-image-1", { prompt: tinyPrompt, size: "1024x1024", n: 1, quality: "high" }),
    tryModel(key, "gpt-image-2", { prompt: tinyPrompt, size: "1024x1024", n: 1, quality: "high" }),
    tryModel(key, "dall-e-3", { prompt: tinyPrompt, size: "1024x1024", n: 1, quality: "standard" }),
    tryModel(key, "dall-e-2", { prompt: tinyPrompt, size: "256x256", n: 1 }),
  ]);

  return NextResponse.json({
    keyHint: `sk-...${key.slice(-4)}`,
    results,
    timestamp: new Date().toISOString(),
  });
}
