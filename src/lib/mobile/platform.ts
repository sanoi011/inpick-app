/**
 * 앱 환경 감지 유틸 — 웹/iOS/Android 분기.
 * 가이드: iOS MD §6, Android MD §6 (WebView 차단 우회)
 *
 * Capacitor는 user-agent에 'CapacitorWebView' 또는 platform-specific 문자열을 넣는다.
 * 클라이언트에서 platform 감지 후 다음을 분기:
 *   - OAuth → 외부 브라우저 (iOS: SFSafariViewController, Android: Chrome Custom Tabs)
 *   - IAP 호출 → cordova-plugin-purchase
 *   - 외부 결제 → 정책 가드 차단
 */

export type InpickRuntimePlatform = "web" | "pwa" | "ios" | "android" | "unknown";

export type InpickPaymentChannel =
  | "web_toss"
  | "web_portone"
  | "web_bootpay"
  | "ios_storekit"
  | "ios_external_kr"
  | "android_play_billing"
  | "android_alternative_billing_kr"
  | "offline_service_pg"
  | "mock";

export function detectPlatform(): InpickRuntimePlatform {
  if (typeof window === "undefined") return "unknown";

  // Capacitor 환경 감지 — isNativePlatform()가 없거나 false여도 getPlatform()으로 재확인.
  // (server.url 원격 로드 시 브릿지 주입 타이밍/버전에 따라 isNativePlatform이 늦게 붙을 수 있음)
  const w = window as unknown as {
    Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean; platform?: string };
  };
  const cap = w.Capacitor;
  if (cap) {
    const platform = cap.getPlatform?.() ?? cap.platform;
    if (platform === "ios") return "ios";
    if (platform === "android") return "android";
    if (cap.isNativePlatform?.()) {
      // 플랫폼 문자열이 없어도 네이티브가 확실하면 UA로 보정
      if (/android/i.test(navigator.userAgent)) return "android";
      return "ios";
    }
  }

  // 원격 server.url 로드나 브릿지 주입 직전에도 앱 진입 게이트가 빠지지 않도록
  // Capacitor 기본/인픽 고정 UA 마커를 두 번째 근거로 사용한다.
  const userAgent = navigator.userAgent || "";
  if (/InPickNative\/|CapacitorWebView/i.test(userAgent)) {
    return /Android/i.test(userAgent) ? "android" : "ios";
  }

  // PWA 감지 (standalone display mode)
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "pwa";

  return "web";
}

export function isNativeApp(): boolean {
  const p = detectPlatform();
  return p === "ios" || p === "android";
}

/**
 * '표시용' WebView 감지 — 임베디드 WebView로 보이면 true (과잉 억제 허용).
 *
 * 용도: 앱 설치 배지·공지 팝업처럼 "앱/WebView 안에서는 안 보여야 하는" UI 억제 전용.
 * Capacitor 주입 타이밍을 놓치거나 카카오톡 인앱브라우저 같은 서드파티 WebView까지 잡는다.
 * ⚠️ 결제/OAuth 분기에는 절대 사용 금지 — 서드파티 WebView 오탐 시 잘못된 결제 채널을 탄다.
 *   그쪽은 반드시 isNativeApp()(Capacitor 정밀 감지) 사용.
 */
/**
 * '확실한 일반 웹 브라우저'일 때만 true — 공지 팝업·설치 배지 표시 게이트 전용.
 *
 * '앱인지'를 감지(어렵고 불확실)하는 대신, '정규 브라우저 탭이 확실한가'를 양성 판정한다.
 * 애매하면 false(표시 안 함) → 앱/인앱브라우저에서 절대 뜨지 않는 것을 보장.
 * 핵심 근거: iOS 인앱 WKWebView(우리 앱 포함)는 UA에 `Safari/`·`Version/` 토큰이 없다.
 *            실제 모바일 Safari는 둘 다 있다.
 */
export function isRegularWebBrowser(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor 흔적이 조금이라도 있으면 앱 — 제외
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) return false;
  // 홈화면 추가(PWA standalone) 제외
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return false;

  const ua = navigator.userAgent || "";
  // 서드파티 인앱 브라우저(카카오/네이버/인스타/페북/라인/다음/안드 wv) 제외
  if (/KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|Snapchat|; wv\)/i.test(ua)) return false;

  if (/iPhone|iPad|iPod/.test(ua)) {
    // 실제 모바일 Safari만 두 토큰 모두 보유. WKWebView(앱)는 없음.
    return /Safari\//.test(ua) && /Version\//.test(ua);
  }
  if (/Android/.test(ua)) {
    return /Chrome\/|Firefox\/|Samsung|Safari\//.test(ua) && !/; wv\)/.test(ua);
  }
  // 데스크탑 등 — 정규 브라우저 토큰 존재 시 true
  return /Chrome\/|Firefox\/|Safari\/|Edg\/|OPR\//.test(ua);
}

export function isProbablyEmbeddedWebView(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) return true;
  const ua = navigator.userAgent;
  // 카카오톡·네이버·인스타 등 서드파티 인앱 브라우저는 '웹 방문자'다 —
  // 설치 배지/공지를 보여줘야 하므로 억제 대상에서 제외 (우리 Capacitor 앱 UA엔 이 마커가 없음)
  if (/KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps/i.test(ua)) return false;
  // iOS WKWebView(우리 앱 셸)는 UA에 Safari 토큰이 없음
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//i.test(ua)) return true;
  // Android System WebView 마커
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true;
  return false;
}

/**
 * OAuth 흐름 — 네이티브 앱에서는 외부 브라우저 사용.
 *
 * iOS: SFSafariViewController (@capacitor/browser)
 * Android: Chrome Custom Tabs (@capacitor/browser)
 * Web/PWA: 일반 redirect
 *
 * 가이드: Google "Use Secure Browsers for OAuth" — embedded WebView에서 Google OAuth 차단됨
 */
export async function openOAuthExternal(url: string): Promise<void> {
  const platform = detectPlatform();
  if (platform === "ios" || platform === "android") {
    try {
      // @capacitor/browser 동적 import (web 환경에서는 없음)
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({
        url,
        windowName: "_self",
        presentationStyle: "fullscreen",
      });
      return;
    } catch (err) {
      console.warn("[mobile] @capacitor/browser 사용 불가:", err);
    }
  }
  // 웹/PWA fallback
  window.location.href = url;
}

/**
 * 앱 결제 채널 결정.
 * 가이드: iOS MD §3, Android MD §3
 */
export function resolvePaymentChannel(input: {
  productKind: "digital_token" | "digital_entitlement" | "digital_subscription" | "offline_service";
}): {
  channel: InpickPaymentChannel;
  allowed: boolean;
  reason?: string;
} {
  const platform = detectPlatform();

  // 오프라인 서비스 (현장 실측비, 시공비)는 platform 무관 일반 PG OK
  if (input.productKind === "offline_service") {
    return { channel: "web_toss", allowed: true };
  }

  // 디지털 상품
  if (platform === "ios") {
    return {
      channel: "ios_storekit",
      allowed: false,
      reason: "iOS 앱 내 디지털 결제는 StoreKit IAP 정책 검토 후 활성화 필요",
    };
  }
  if (platform === "android") {
    return {
      channel: "android_play_billing",
      allowed: false,
      reason: "Android 앱 내 디지털 결제는 Play Billing 정책 검토 후 활성화 필요",
    };
  }
  // web / pwa
  return { channel: "web_toss", allowed: true };
}

/**
 * 앱 버전 정보 (Capacitor App plugin).
 */
export async function getAppInfo(): Promise<{
  platform: InpickRuntimePlatform;
  version?: string;
  build?: string;
}> {
  const platform = detectPlatform();
  if (platform !== "ios" && platform !== "android") {
    return { platform };
  }
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return { platform, version: info.version, build: info.build };
  } catch {
    return { platform };
  }
}
