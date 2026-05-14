import { NextResponse } from "next/server";

/**
 * 표준 API 에러 응답 생성
 */
export function apiError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 표준 API 성공 응답 생성
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * 필수 환경변수 검증
 * 앱 시작 시 또는 API 호출 시 사용
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * 환경변수 상태 확인 (관리자용).
 *
 * AI Provider Policy (2026-05-10):
 *   - REQUIRED: ANTHROPIC_API_KEY, OPENAI_API_KEY (채팅+이미지)
 *   - OPTIONAL: RUNPOD_API_KEY (Flux 이미지/SAM)
 *   - DEPRECATED: GOOGLE_GEMINI_API_KEY (정책상 차단됨 — 제거 권장)
 */
export function getEnvStatus() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
  };
  const optional = {
    RUNPOD_API_KEY: !!process.env.RUNPOD_API_KEY,
    RUNPOD_FLUX_ENDPOINT: !!process.env.RUNPOD_FLUX_ENDPOINT,
    TOSS_PAYMENTS_CLIENT_KEY: !!process.env.TOSS_PAYMENTS_CLIENT_KEY,
    TOSS_PAYMENTS_SECRET_KEY: !!process.env.TOSS_PAYMENTS_SECRET_KEY,
    NEXT_PUBLIC_TOSS_CLIENT_KEY: !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    TOSS_WEBHOOK_SECRET: !!process.env.TOSS_WEBHOOK_SECRET,
    JUSO_API_KEY: !!process.env.JUSO_API_KEY,
    AI_PROVIDER_POLICY: !!process.env.AI_PROVIDER_POLICY,
    IMAGE_GEN_BACKEND: !!process.env.IMAGE_GEN_BACKEND,
  };

  // Toss 모드 진단
  const clientKey = process.env.TOSS_PAYMENTS_CLIENT_KEY ?? "";
  const tossMode: "live" | "test" | "mock" = clientKey.startsWith("live_")
    ? "live"
    : clientKey.startsWith("test_")
      ? "test"
      : "mock";
  const deprecated = {
    // 정책상 사용 중지 — 이 키가 set 되어 있으면 경고
    GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
  };

  // 호환 — 기존 vars 필드 유지 (관리자 페이지 영향 최소화)
  const vars = { ...required, ...optional };

  return {
    vars,
    required,
    optional,
    deprecated,
    deprecatedWarnings: deprecated.GOOGLE_GEMINI_API_KEY
      ? [
          "GOOGLE_GEMINI_API_KEY가 설정되어 있으나 정책(AI_PROVIDER_POLICY=anthropic_openai_runpod_only)으로 차단됩니다. Vercel 환경변수에서 제거 권장.",
        ]
      : [],
    allConfigured: Object.values(required).every(Boolean),
    missingCount: Object.values(required).filter((v) => !v).length,
    payments: {
      tossMode,
      tossModeLabelKo:
        tossMode === "live"
          ? "라이브 (실결제)"
          : tossMode === "test"
            ? "테스트 (Toss 위젯 호출, 실결제 없음)"
            : "Mock (즉시 부여, 결제 없음)",
      clientKeyPrefix: clientKey ? clientKey.slice(0, 8) + "…" : null,
      secretKeyConfigured: !!process.env.TOSS_PAYMENTS_SECRET_KEY,
      webhookConfigured: !!process.env.TOSS_WEBHOOK_SECRET,
    },
  };
}
