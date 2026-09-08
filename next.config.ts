import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.qfilm.tv",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "a.qfilm.tv",
        pathname: "/social-thumb.php",
      },
    ],
  },
};

export default nextConfig;
