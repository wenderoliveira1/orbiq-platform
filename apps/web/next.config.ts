import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright executa o servidor local pelo loopback 127.0.0.1.
  // Next.js bloqueia recursos de desenvolvimento cross-origin por padrão;
  // liberar somente este host mantém o AutoQA hidratado sem ampliar a origem.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
