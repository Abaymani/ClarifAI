import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md holds the team's own agent rules; without this, `next dev` inserts
  // its own block there whenever an AI coding agent runs it.
  agentRules: false,
};

export default nextConfig;
