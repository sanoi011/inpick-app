/**
 * 통합 소셜 로그인 시작 헬퍼 — 웹/네이티브 앱 분기.
 *
 * 웹/PWA:
 *   - supabase.auth.signInWithOAuth가 자동으로 provider 인증 페이지로 redirect.
 *
 * 네이티브 앱(iOS/Android, Capacitor WebView):
 *   - System WebView는 카카오/구글이 보안상 로그인 차단 → 외부 브라우저 필요.
 *   - skipBrowserRedirect=true 로 authorize URL만 받아서
 *     openOAuthExternal()(iOS SFSafariViewController / Android Chrome Custom Tabs)로 오픈.
 *   - 인증 완료 후 콜백 복귀는 딥링크(appUrlOpen 리스너)가 처리 — 네이티브 프로젝트 설정 필요.
 *
 * 네이버는 Supabase 미지원 → /api/auth/naver/start 커스텀 라우트로 별도 처리(이 헬퍼 미사용).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectPlatform, openOAuthExternal } from "@/lib/mobile/platform";

export type SupabaseOAuthProvider = "google" | "kakao" | "apple";

/**
 * 네이티브 앱 OAuth 복귀용 딥링크.
 * - 외부 브라우저에서 로그인 완료 후 이 스킴으로 앱에 되돌아옴 → appUrlOpen 리스너가 code 교환.
 * - Supabase 대시보드 Auth → URL Configuration → Redirect URLs 에 이 값 등록 필요.
 * - Android: AndroidManifest intent-filter(scheme kr.inpick.app, host auth) / iOS: Info.plist CFBundleURLTypes
 */
export const NATIVE_OAUTH_REDIRECT = "kr.inpick.app://auth/callback";

/**
 * iOS는 SFSafariViewController가 302→커스텀 스킴을 간헐 차단
 * ("주소가 유효하지 않아 Safari가 페이지를 열 수 없습니다") →
 * HTTPS 브릿지 페이지(/auth/app-return)로 복귀 후 자동/버튼으로 딥링크 점프.
 * Android(Chrome Custom Tabs)는 직접 딥링크가 검증돼 있어 유지.
 * ⚠️ Supabase 대시보드 Redirect URLs에 https://www.interiorpick.co.kr/auth/app-return 등록 필요.
 */
function nativeRedirectTarget(platform: ReturnType<typeof detectPlatform>): string {
  if (platform === "ios" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/app-return`;
  }
  return NATIVE_OAUTH_REDIRECT;
}

export async function startOAuth(
  supabase: SupabaseClient,
  provider: SupabaseOAuthProvider,
  opts: { redirectTo: string; queryParams?: Record<string, string> }
): Promise<{ error?: string }> {
  const platform = detectPlatform();
  const isNative = platform === "ios" || platform === "android";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // 네이티브: iOS=브릿지 페이지 / Android=딥링크 · 웹·PWA: 기존 콜백 URL
      redirectTo: isNative ? nativeRedirectTarget(platform) : opts.redirectTo,
      queryParams: opts.queryParams,
      // 네이티브: 자동 redirect 막고 우리가 외부 브라우저로 직접 오픈
      skipBrowserRedirect: isNative,
    },
  });

  if (error) return { error: error.message };

  if (isNative && data?.url) {
    // Chrome Custom Tabs / SFSafariViewController로 오픈 (System WebView 차단 우회)
    await openOAuthExternal(data.url);
  }
  // 웹: skipBrowserRedirect=false 이므로 supabase가 이미 redirect 수행 (반환값 무의미)
  return {};
}
