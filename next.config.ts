import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Node-only mail libraries: load them from node_modules at runtime instead of bundling.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
};

export default nextConfig;
