import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The design system is consumed as workspace source (.ts/.tsx), not a build artefact.
  transpilePackages: ["@privy360/ui", "@privy360/regulatory"],
  poweredByHeader: false,
  // The repository's root AGENTS.md is the authoritative agent guidance; do not generate a second copy.
  agentRules: false,
};

export default nextConfig;
