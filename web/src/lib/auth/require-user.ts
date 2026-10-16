import "server-only";

import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  return getOrCreateUser({
    user: { id: data.user.id, email: data.user.email, nickname: data.user.user_metadata?.nickname },
  });
}

export async function requireUser() {
  const user = await getAuthenticatedUserOrNull();
  if (!user) throw new Error("No autenticado");
  return user;
}

/**
 * Fila `User` de la persona con sesión SIN crearla (a diferencia de `getAuthenticatedUserOrNull`). Para eliminar la cuenta:
 * un doble envío no debe recrear un usuario vacío que genere un segundo resumen anónimo. Null si no hay sesión o ya no existe.
 */
export async function getExistingUserOrNull() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}
