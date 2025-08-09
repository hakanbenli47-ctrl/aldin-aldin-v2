import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "oyrsckfjwdxpjfufifid.supabase.co",
      "www.80bir.com.tr",
      // "cdn.80bir.com.tr", // CDN açarsan ekle
    ],
    unoptimized: true,
  },
  async redirects() {
    return [
      // kök domain → www
      { source: "http://80bir.com.tr/:path*",  destination: "https://www.80bir.com.tr/:path*", permanent: true },
      { source: "https://80bir.com.tr/:path*", destination: "https://www.80bir.com.tr/:path*", permanent: true },
    ];
  },
};
export default nextConfig;
