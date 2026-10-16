import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { AFTER_LINK_CHOOSE_PASSWORD, AFTER_LINK_COOKIE } from "@/lib/auth/after-link";

import { createClient } from "@/lib/supabase/server";

function loginRedirect(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient();

  const error = code
    ? (await supabase.auth.exchangeCodeForSession(code)).error
    : tokenHash && type
      ? (await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        })).error
      : new Error("Falta el código de confirmación.");

  if (error) {
    return loginRedirect(request, "confirmation");
  }

  // Si el enlace salió de "¿Olvidaste tu contraseña?", sigue la pantalla de elegir una nueva (la cookie se usa una sola vez).
  const chooseNext = request.cookies.get(AFTER_LINK_COOKIE)?.value === AFTER_LINK_CHOOSE_PASSWORD;
  const response = NextResponse.redirect(new URL(chooseNext ? "/elegir-contrasena" : "/account", request.url));
  if (request.cookies.has(AFTER_LINK_COOKIE)) response.cookies.delete(AFTER_LINK_COOKIE);
  return response;
}
