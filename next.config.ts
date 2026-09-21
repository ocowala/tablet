import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev overlay sits on top of the text, which defeats the point of
  // looking at the reading screen.
  devIndicators: false,
  experimental: {
    // The grading route fans out three model calls, so give it room.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
