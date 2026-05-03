import path from "path";
import { fileURLToPath } from "url";
import bundleAnalyzer from "@next/bundle-analyzer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 ESLint 실패해도 배포 진행 (코드 품질은 CI 별도 검증)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@react-three/drei",
      "@react-three/postprocessing",
      "three",
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // canvas is an optional peer dep of pdfjs-dist (native module, not available on Vercel)
    // Ignore it so webpack doesn't fail when resolving pdfjs-dist dependencies
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
      })
    );

    if (isServer) {
      // Server: onnxruntime-web is browser-only, ignore completely
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^onnxruntime-web$/,
        })
      );
    } else {
      // Client: use CJS build (no import.meta, compatible with SWC)
      config.resolve = {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          "onnxruntime-web": path.resolve(
            __dirname,
            "node_modules/onnxruntime-web/dist/ort.min.js"
          ),
        },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
