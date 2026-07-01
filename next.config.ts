import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  transpilePackages: ["next-auth", "@auth/prisma-adapter"], // TAMBAHKAN INI
};

export default nextConfig;
