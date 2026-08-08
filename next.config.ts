import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mastra/core", "@mastra/pg"],
};

export default nextConfig;
