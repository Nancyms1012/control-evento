import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Cloudflare Pages doesn't support dynamic rendering
  // All pages must be prerendered as static
};

export default nextConfig;
