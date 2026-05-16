import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@billtrack/ui", "@billtrack/shared"],
};

export default nextConfig;
