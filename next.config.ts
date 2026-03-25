import type { NextConfig } from "next";

const isDockerBuild = process.env.DOCKER_BUILD === "1";
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isDockerBuild && isProduction ? { output: "standalone" as const } : {}),
  // Serve this Next app under /panel so nginx routing works with Next links.
  basePath: "/panel",
  assetPrefix: "/panel",
};

export default nextConfig;
