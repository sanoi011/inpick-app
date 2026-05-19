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

  // Capacitor 환경 감지
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) {
    const platform = w.Capacitor.getPlatform?.();
    if (platform === "ios") return "ios";
    if (platform === "android") return "android";
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
