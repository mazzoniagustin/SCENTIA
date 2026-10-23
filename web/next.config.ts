import type { NextConfig } from "next";

// Cabeceras de seguridad estáticas para todas las rutas. La Content-Security-Policy no va acá: lleva un
// nonce por request y la genera src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Si dos reglas fijan la misma cabecera, gana la última (docs: headers > Header Overriding Behavior).
    // La colección compartida lleva el token en la URL: no debe filtrarse por el Referer.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/c/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
