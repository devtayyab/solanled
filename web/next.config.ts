import type { NextConfig } from "next";

const config: NextConfig = {
  typedRoutes: true,
  // Parent repo has a pnpm-lock.yaml; pin Turbopack root to this folder.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "www.sloanled.eu" },
    ],
  },
};

export default config;
