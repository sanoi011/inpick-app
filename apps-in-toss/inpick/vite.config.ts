import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const inpickSource = path.resolve(here, "inpick-source/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const publicProcessEnv = {
    NODE_ENV: mode === "production" ? "production" : "development",
    NEXT_PUBLIC_SITE_URL: "https://www.interiorpick.co.kr",
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_CONTRACTOR_BIDDING_ENABLED: "false",
  };

  return {
    plugins: [react()],
    publicDir: path.resolve(here, "inpick-source/public"),
    resolve: {
      alias: [
        {
          find: "@/components/billing/TokenPurchaseDrawer",
          replacement: path.resolve(here, "src/payments/TokenPurchaseDrawer.tsx"),
        },
        {
          find: "@/components/payments/EstimatePdfPurchaseModal",
          replacement: path.resolve(here, "src/payments/EstimatePdfPurchaseModal.tsx"),
        },
        { find: "@", replacement: inpickSource },
        { find: "next/navigation", replacement: path.resolve(here, "src/adapters/navigation.tsx") },
        { find: "next/link", replacement: path.resolve(here, "src/adapters/navigation.tsx") },
        { find: "next/dynamic", replacement: path.resolve(here, "src/adapters/dynamic.tsx") },
        { find: "react", replacement: path.resolve(repoRoot, "node_modules/react") },
        { find: "react-dom", replacement: path.resolve(repoRoot, "node_modules/react-dom") },
      ],
    },
    define: {
      "process.env": JSON.stringify(publicProcessEnv),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2_000,
    },
  };
});
