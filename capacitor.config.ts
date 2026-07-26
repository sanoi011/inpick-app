import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 설정 — InPick 모바일 앱.
 *
 * 전략:
 *   - Vercel 배포 사이트(inpick-app.vercel.app)를 native shell의 WebView에서 로드
 *   - Native plugin으로 카메라/푸시/공유 등 기능 추가 (Apple 4.2.0 가이드라인 충족)
 *   - 빌드 시점에 server.url 활성/비활성 토글
 *
 * Apple 가이드라인 4.2.0 회피:
 *   - 단순 WebView wrapper는 거부됨
 *   - 우리는 Camera API + Push Notifications + LIDAR(추후 plugin) 등 native 기능 통합
 */
const config: CapacitorConfig = {
  appId: "kr.inpick.app",
  appName: "InPick",
  // WebView가 원격 운영 도메인을 로드해도 웹 코드가 앱을 확실히 식별한다.
  // 기존 window.Capacitor 감지와 함께 앱 시작 인증 게이트의 이중 근거로 사용.
  appendUserAgent: " InPickNative/1 CapacitorWebView",

  // webDir — npx cap sync 시 native 프로젝트로 복사할 정적 자산.
  // Vercel 사이트를 직접 로드하므로 placeholder만 두면 됨 (public/ 자체 사용).
  webDir: "public",

  // 운영 — 운영 도메인을 WebView가 로드 (server.url 방식 → 웹 배포만 하면 앱도 자동 갱신)
  // 개발 시 server.url을 로컬로 바꿔서 핫리로드 가능 (예: http://192.168.x.x:3000)
  server: {
    // canonical(www)로 직접 로드 — 사이트가 non-www→www(307)로 리다이렉트하기 때문.
    // server.url과 호스트가 다른 내비게이션을 Capacitor가 "외부"로 보고 Safari로 던지는 문제 방지.
    url: "https://www.interiorpick.co.kr",
    // 두 호스트 모두 인앱 WebView 내비게이션으로 허용(외부 Safari 전환 방지).
    // nid.naver.com: 네이버 OAuth 로그인을 인앱 WebView에서 완결(외부 Safari로 나가면
    // Apple Guideline 4 거절 — 2026-07-07 v1.0(5) 리젝 사유). 콜백은 same-origin이라
    // 세션 쿠키가 WebView에 그대로 박힘. 로그인 화면 외 naver.com 링크는 종전대로 외부 오픈.
    allowNavigation: [
      "interiorpick.co.kr",
      "www.interiorpick.co.kr",
      "inpick-hankwon.vercel.app",
      "write.interiorpick.co.kr",
      "nid.naver.com",
    ],
    cleartext: false,           // HTTPS 강제
    androidScheme: "https",
  },

  // 6각형 다홍색 테마
  backgroundColor: "#F73B20",   // primary-500 (메모리 — InPick 메인 톤)

  ios: {
    contentInset: "automatic",
    backgroundColor: "#FFFFFF",
    // 사용자가 카메라/사진 접근 허용 시 사용. Info.plist 설정도 필요 (Xcode UI에서 자동 prompt).
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: "#FFFFFF",
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",   // 인스타 스타일 흰 로딩화면 (아이콘 중앙 + 하단 AIOD)
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#F73B20",
    },
    Camera: {
      // RoomPlan/PolyCam 통합 시 활용
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    GoogleAuth: {
      // iOS OAuth 클라이언트 ID (GoogleService-Info.plist의 CLIENT_ID)
      iosClientId: "100217844228-6o0qc3denccvsrht4sbv5hvb76h0vt2k.apps.googleusercontent.com",
      scopes: ["profile", "email"],
      // serverClientId 미설정 → idToken aud = iOS 클라이언트 ID.
      //   Supabase Google provider의 'Authorized Client IDs'에 이 iOS 클라이언트 ID를 추가해야 함.
    },
  },
};

export default config;
