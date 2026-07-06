/**
 * 네이티브 로그인 (iOS/Android 앱 전용) — SFSafariViewController/웹뷰 없이 SDK로 직접.
 *
 * 흐름: 네이티브 SDK가 ID 토큰 발급 → Supabase signInWithIdToken → 세션 확립.
 *   - 웹뷰를 아예 안 열어서 "주소가 유효하지 않음" Safari 에러가 원천 소멸.
 *   - 웹/PWA에서는 이 파일을 쓰지 않음(기존 startOAuth 유지).
 *
 * 사전 설정:
 *   - Apple: App ID에 Sign in with Apple 활성(이미 됨). 추가 키 불필요(네이티브는 identityToken 사용).
 *   - Google: iOS OAuth 클라이언트 + GoogleService-Info.plist(Info.plist에 REVERSED_CLIENT_ID URL 스킴),
 *             Supabase Google provider의 Authorized Client IDs에 iOS 클라이언트 ID 추가.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectPlatform } from "@/lib/mobile/platform";

export function isNativeSigninAvailable(): boolean {
  const p = detectPlatform();
  return p === "ios" || p === "android";
}

/** raw nonce 생성 + SHA-256 해시(hex) — Apple signInWithIdToken 재생공격 방지용 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

/** 애플 네이티브 로그인 → Supabase 세션 */
export async function signInWithAppleNative(
  supabase: SupabaseClient,
): Promise<{ error?: string }> {
  try {
    const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
    const { raw, hashed } = await makeNonce();
    const res = await SignInWithApple.authorize({
      clientId: "kr.inpick.app", // App ID (네이티브는 App ID 사용)
      scopes: "email name",
      // 네이티브 iOS는 redirectURI를 실제로 안 쓰지만 타입상 필수 — Services ID Return URL 재사용
      redirectURI: "https://pyhsjjtxcfmkcqmaxozd.supabase.co/auth/v1/callback",
      nonce: hashed, // Apple에는 해시된 nonce
    });
    const idToken = res.response?.identityToken;
    if (!idToken) return { error: "애플 인증 토큰을 받지 못했습니다" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: idToken,
      nonce: raw, // Supabase에는 원본 nonce
    });
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|1001|user/i.test(msg)) return { error: "" }; // 사용자 취소 — 조용히
    return { error: msg };
  }
}

/** 구글 네이티브 로그인 → Supabase 세션 */
export async function signInWithGoogleNative(
  supabase: SupabaseClient,
): Promise<{ error?: string }> {
  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    // 플러그인 초기화(idempotent) — clientId는 네이티브 plist/strings에서 읽으므로 여기선 옵션만
    try {
      await GoogleAuth.initialize({
        scopes: ["profile", "email"],
        grantOfflineAccess: false,
      });
    } catch {
      /* 이미 초기화됨 */
    }
    const user = await GoogleAuth.signIn();
    const idToken = user?.authentication?.idToken;
    if (!idToken) return { error: "구글 인증 토큰을 받지 못했습니다" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|popup_closed|12501|user/i.test(msg)) return { error: "" }; // 취소
    return { error: msg };
  }
}
