import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  reactStrictMode: true,
  images: {
    domains: ["oyrsckfjwdxpjfufifid.supabase.co"], // ← Kendi Supabase domainin!
    unoptimized: true
  }
};

export default nextConfig;
