import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev uniquement : validation sur iPhone via le réseau local (sans effet sur le build de prod).
  allowedDevOrigins: ["192.168.1.12"],
};

export default nextConfig;
