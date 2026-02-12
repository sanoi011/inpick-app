import path from "path";
import { fileURLToPath } from "url";
import bundleAnalyzer from "@next/bundle-analyzer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
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
