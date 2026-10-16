import { NextRequest, NextResponse } from "next/server";

import { getPasswordSet, needsPasswordSetup } from "@/lib/auth/password-gate";
import { buildCsp, CSP_HEADER_NAME } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" });

  // Encabezados en la REQUEST (Next lee el nonce de ahí al renderizar). `updateSession` crea su
  // respuesta con esta misma request, así que los conserva y no se pierden las cookies de sesión.
  request.headers.set("x-nonce", nonce);
  request.headers.set(CSP_HEADER_NAME, csp);

  const { response, claims } = await updateSession(request);

  // Quien entró por enlace y aún no tiene contraseña debe elegir una antes de seguir (docs/cuenta-con-contrasena.md).
  if (
    needsPasswordSetup({
      method: request.method,
      hasSession: claims !== null,
      passwordSet: getPasswordSet(claims),
      pathname: request.nextUrl.pathname,
    })
  ) {
    const redirect = NextResponse.redirect(new URL("/elegir-contrasena", request.url));
    // Conserva las cookies de sesión que `updateSession` pudo refrescar.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set(CSP_HEADER_NAME, csp);
    return redirect;
  }

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
