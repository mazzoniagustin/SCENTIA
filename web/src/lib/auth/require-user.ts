import "server-only";

import { getOrCreateUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Fila `User` (cuid) de la persona con sesión; la crea si es su primer ingreso.
 * Devuelve null si no hay sesión. Toda lectura/escritura de datos personales debe partir de este
 * id y nunca de uno enviado por el cliente.
 */
export async function getAuthenticatedUserOrNull() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) return null;

  return getOrCreateUser({ user: { id: data.user.id, email: data.user.email } });
}

export async function requireUser() {
  const user = await getAuthenticatedUserOrNull();
  if (!user) throw new Error("No autenticado");
  return user;
}
