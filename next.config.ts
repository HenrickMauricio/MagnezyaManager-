import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Esconde o botão de desenvolvimento do Next.js (canto inferior esquerdo).
  devIndicators: false,
  experimental: {
    // Fotografias de artigos (máx. 8 MB cada, uma por pedido) + margem do multipart.
    serverActions: { bodySizeLimit: "9mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
