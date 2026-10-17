import type { NextConfig } from "next";
import path from "path";

const pages = process.env.GITHUB_PAGES === "1";
// 기본은 항상 out/ 정적보내기. Capacitor가 .next 서버 산출물을 묶지 않게 한다.
// next start 서버 시험만 NEXT_SERVER=1 (npm run start:server).
const staticExport = process.env.NEXT_SERVER !== "1";

const nextConfig: NextConfig = {
  ...(staticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        ...(pages ? { basePath: "/church", assetPrefix: "/church" } : {}),
      }
    : {}),
  images: { unoptimized: true },
  serverExternalPackages: ["unpdf"],
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/data/**"],
      };
    }
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        child_process: path.join(__dirname, "lib/empty-node.ts"),
        zlib: path.join(__dirname, "lib/zlib-browser.ts"),
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
      };
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
