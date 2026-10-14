import type { NextConfig } from "next";
import path from "path";

const pages = process.env.GITHUB_PAGES === "1";
const staticExport = pages || process.env.STATIC_EXPORT === "1";

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
