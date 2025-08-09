import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "oyrsckfjwdxpjfufifid.supabase.co",
      "www.80bir.com.tr",
    ],
    unoptimized: true,
  },
  async redirects() {
    return [
      // non-www → www yönlendirmesi
      {
        source: "/:path*",
        has: [{ type: "host", value: "80bir.com.tr" }],
        destination: "https://www.80bir.com.tr/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
