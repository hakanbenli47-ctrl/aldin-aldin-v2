import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: {
    domains: ["oyrsckfjwdxpjfufifid.supabase.co"], // ← Kendi Supabase domainin!
    unoptimized: true
  }
};

export default nextConfig;
