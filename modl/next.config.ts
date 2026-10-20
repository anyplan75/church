import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "surrounding-impressive-beads-reception.trycloudflare.com"],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: ["surrounding-impressive-beads-reception.trycloudflare.com"],
    },
  },
};

export default nextConfig;
