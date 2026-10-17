import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getOrCreateUser } from "@/lib/auth";
import { AFTER_LINK_CHOOSE_PASSWORD, AFTER_LINK_COOKIE } from "@/lib/auth/after-link";
import { logServerError } from "@/lib/log";

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

  // Crea la fila de la base (con el apodo elegido al registrarse) ya acá: si se creara recién al abrir /account, la cabecera de esa
  // misma respuesta (que lee el apodo en paralelo) saldría con "Mi cuenta" y se quedaría así hasta recargar. Un fallo no frena el ingreso.
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) {
      await getOrCreateUser({
        user: { id: data.user.id, email: data.user.email, nickname: data.user.user_metadata?.nickname },
      });
    }
  } catch (cause) {
    logServerError("auth/confirm", cause);
  }

  // Si el enlace salió de "¿Olvidaste tu contraseña?", sigue la pantalla de elegir una nueva (la cookie se usa una sola vez).
  const chooseNext = request.cookies.get(AFTER_LINK_COOKIE)?.value === AFTER_LINK_CHOOSE_PASSWORD;
  const response = NextResponse.redirect(new URL(chooseNext ? "/elegir-contrasena" : "/account", request.url));
  if (request.cookies.has(AFTER_LINK_COOKIE)) response.cookies.delete(AFTER_LINK_COOKIE);
  return response;
}
