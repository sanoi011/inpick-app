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
 * 환경변수 상태 확인 (관리자용)
 */
export function getEnvStatus() {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
    TOSS_PAYMENTS_CLIENT_KEY: !!process.env.TOSS_PAYMENTS_CLIENT_KEY,
    TOSS_PAYMENTS_SECRET_KEY: !!process.env.TOSS_PAYMENTS_SECRET_KEY,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
  };

  return {
    vars,
    allConfigured: Object.values(vars).every(Boolean),
    missingCount: Object.values(vars).filter((v) => !v).length,
  };
}
