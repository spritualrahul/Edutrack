import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's root to this directory so it doesn't get confused
  // by the yarn.lock at the monorepo root level.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
