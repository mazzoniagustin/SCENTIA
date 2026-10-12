import { NextRequest } from "next/server";

import { buildCsp, CSP_HEADER_NAME } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" });

  // Encabezados en la REQUEST (Next lee el nonce de ahí al renderizar). `updateSession` crea su
  // respuesta con esta misma request, así que los conserva y no se pierden las cookies de sesión.
  request.headers.set("x-nonce", nonce);
  request.headers.set(CSP_HEADER_NAME, csp);

  const response = await updateSession(request);
  response.headers.set(CSP_HEADER_NAME, csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
