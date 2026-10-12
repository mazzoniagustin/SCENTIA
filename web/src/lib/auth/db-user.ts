import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Id (cuid) de la fila `User` de la persona con sesión, o null si no hay sesión
 * o todavía no tiene fila. `getCurrentUser()` devuelve el UUID de Supabase, que
 * NO es la clave de `UserCollection.userId`. Es solo lectura: un GET no crea usuarios.
 */
export const getSessionDbUserId = cache(async (): Promise<string | null> => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: sessionUser.id },
    select: { id: true },
  });
  return dbUser?.id ?? null;
});

/**
 * Apodo de la persona con sesión para la cabecera, o null (sin sesión, sin apodo o si la consulta falla).
 * Una sola consulta por petición (`cache`), de solo lectura. Nunca devuelve el correo.
 */
export const getSessionNickname = cache(async (): Promise<string | null> => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const row = await prisma.user.findUnique({
    where: { supabaseId: sessionUser.id },
    select: { profile: { select: { nickname: true } } },
  });
  return row?.profile?.nickname ?? null;
});
