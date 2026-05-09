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

  // webDir — npx cap sync 시 native 프로젝트로 복사할 정적 자산.
  // Vercel 사이트를 직접 로드하므로 placeholder만 두면 됨 (public/ 자체 사용).
  webDir: "public",

  // 운영 — Vercel 배포 사이트를 WebView가 로드
  // 개발 시 server.url을 로컬로 바꿔서 핫리로드 가능 (예: http://192.168.x.x:3000)
  server: {
    url: "https://inpick-app.vercel.app",
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
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#F73B20",
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
  },
};

export default config;
