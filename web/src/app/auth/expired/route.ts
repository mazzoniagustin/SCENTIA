import { NextResponse, type NextRequest } from "next/server";

import { hasVerifiedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Destino de las pantallas que descubren que la sesión ya no vale (la cuenta de Supabase se eliminó o la sesión se revocó, pero el
// JWT guardado en la cookie sigue sin vencer). Borra esas cookies para que la cabecera deje de mostrar a alguien con sesión y /login
// no rebote a /account. Solo cierra la sesión si de verdad no es válida: un enlace ajeno no puede desloguear a una persona con sesión.
export async function GET(request: NextRequest) {
  if (await hasVerifiedSession()) return NextResponse.redirect(new URL("/account", request.url));
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.url));
}
