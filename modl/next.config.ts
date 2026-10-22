import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["mapbox-gl"],
  serverExternalPackages: [
    "@google-cloud/cloud-sql-connector",
    "@google-cloud/sql",
    "@grpc/grpc-js",
    "google-gax",
    "pg",
    "mammoth",
    "unpdf",
    "cfb",
  ],
  outputFileTracingIncludes: {
    "/**": ["./src/server/db/migrations/**/*.sql"],
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "surrounding-impressive-beads-reception.trycloudflare.com",
    "milwaukee-biographies-double-habitat.trycloudflare.com",
    "influences-dramatic-customers-tissue.trycloudflare.com",
    "shape-recreational-character-transition.trycloudflare.com",
    "phd-poker-longer-arctic.trycloudflare.com",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
      allowedOrigins: [
        "surrounding-impressive-beads-reception.trycloudflare.com",
        "milwaukee-biographies-double-habitat.trycloudflare.com",
        "influences-dramatic-customers-tissue.trycloudflare.com",
        "shape-recreational-character-transition.trycloudflare.com",
        "phd-poker-longer-arctic.trycloudflare.com",
        "modl--modl-comm.asia-east1.hosted.app",
        "modl-jeju.vercel.app",
      ],
    },
  },
};

export default nextConfig;
