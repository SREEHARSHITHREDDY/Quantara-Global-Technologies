import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "6mb" } }, // resumes are accepted up to 5 MB
  poweredByHeader: false,
  transpilePackages: ["@quantara/content", "@quantara/rbac", "@quantara/db", "@quantara/council", "@quantara/worker"],
  serverExternalPackages: ["pg", "pg-boss", "@node-rs/argon2"],
  async headers() { return [{ source: "/:path*", headers: [...securityHeaders] }]; },
};
export default config;
