import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md holds the team's own agent rules; without this, `next dev` inserts
  // its own block there whenever an AI coding agent runs it.
  agentRules: false,
  // The analysis reads the framework files at runtime. Listing the folder makes
  // sure every file in it ships with the session page, including ones added later.
  outputFileTracingIncludes: {
    "/session": ["./framework/**/*"],
  },
};

export default nextConfig;
