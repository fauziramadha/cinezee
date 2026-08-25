import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  generateBuildId: () => 'cinestream-v14-' + Date.now().toString(),
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Anime (Otakudesu + Animasu)
      { protocol: "https", hostname: "otakudesu.blog" },
      { protocol: "https", hostname: "v1.animasu.work" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "i3.wp.com" },
      // Donghua (Anichin + Donghub)
      { protocol: "https", hostname: "anichin.cafe" },
      { protocol: "https", hostname: "donghub.vip" },
      // Komik (Komiku)
      { protocol: "https", hostname: "thumbnail.komiku.org" },
      { protocol: "https", hostname: "img.komiku.org" },
      { protocol: "https", hostname: "img1.komiku.org" },
      { protocol: "https", hostname: "img2.komiku.org" },
      { protocol: "https", hostname: "img3.komiku.org" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
    ],
  },
};

export default nextConfig;
