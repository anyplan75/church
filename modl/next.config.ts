import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "127.0.0.1",
    "surrounding-impressive-beads-reception.trycloudflare.com",
    "milwaukee-biographies-double-habitat.trycloudflare.com",
    "influences-dramatic-customers-tissue.trycloudflare.com",
    "shape-recreational-character-transition.trycloudflare.com",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: [
        "surrounding-impressive-beads-reception.trycloudflare.com",
        "milwaukee-biographies-double-habitat.trycloudflare.com",
        "influences-dramatic-customers-tissue.trycloudflare.com",
        "shape-recreational-character-transition.trycloudflare.com",
      ],
    },
  },
};

export default nextConfig;
