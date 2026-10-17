import "server-only";

import { cache } from "react";

import { canChoosePassword, getPasswordSet } from "@/lib/auth/password-gate";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: claimsResult,
    error,
  } = await supabase.auth.getClaims();

  if (error || !claimsResult?.claims?.sub) {
    return null;
  }

  return {
    id: claimsResult.claims.sub,
    passwordSet: getPasswordSet(claimsResult.claims),
    canChoosePassword: canChoosePassword(claimsResult.claims, Math.floor(Date.now() / 1000)),
  };
});

/**
 * ¿La sesión es válida de verdad? `getCurrentUser` solo lee el JWT local (puede seguir "válido" aunque la cuenta de Supabase ya no
 * exista o la sesión se haya revocado); esto consulta a Supabase con `getUser()`, igual que `/account` (`getAuthenticatedUserOrNull`).
 * Usarlo donde una redirección dependa de que `/account` vaya a aceptar la sesión: si dos pantallas se contradicen, redirigen entre
 * sí sin fin (/login → /account → /login).
 */
export const hasVerifiedSession = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user?.email);
});
