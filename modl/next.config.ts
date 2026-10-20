import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "cube-excuse-endif-moisture.trycloudflare.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: ["cube-excuse-endif-moisture.trycloudflare.com"],
    },
  },
};

export default nextConfig;
