import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "inpick",
  brand: {
    displayName: "인픽",
    primaryColor: "#F73B20",
    icon: "https://www.interiorpick.co.kr/icons/icon-512x512.png",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite --host 0.0.0.0",
      build: "tsc -b && vite build",
    },
  },
  permissions: [],
  outdir: "dist",
  webViewProps: {
    type: "partner",
    bounces: true,
    pullToRefreshEnabled: true,
    allowsInlineMediaPlayback: false,
    mediaPlaybackRequiresUserAction: true,
    allowsBackForwardNavigationGestures: true,
    overScrollMode: "never",
  },
});
