/**
 * GET /api/inpick/health
 *
 * OpenAI / Supabase 등 외부 의존성 상태 진단.
 * - 키가 설정되어 있는지 (값은 노출 안 함)
 * - 모드 (mock vs real)
 * - 응답: { openai: { configured, mode }, ... }
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const forceMock = process.env.INPICK_FORCE_MOCK_RENDER === "true";

  return NextResponse.json({
    openai: {
      configured: !!openaiKey,
      keyHint: openaiKey ? `sk-...${openaiKey.slice(-4)}` : null,
      forceMock,
      mode: !openaiKey || forceMock ? "mock" : "live",
    },
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    timestamp: new Date().toISOString(),
  });
}
