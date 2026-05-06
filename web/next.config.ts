import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    typedRoutes: true,
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
