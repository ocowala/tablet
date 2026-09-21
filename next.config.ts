import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The grading route fans out three model calls, so give it room.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
