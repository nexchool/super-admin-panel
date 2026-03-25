import type { NextConfig } from "next";

const isDockerBuild = process.env.DOCKER_BUILD === "1";
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isDockerBuild && isProduction ? { output: "standalone" as const } : {}),
};

export default nextConfig;
