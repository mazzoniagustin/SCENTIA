import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

/**
 * Elimina la identidad de Supabase Auth de la persona. Necesita la clave de servicio
 * (SUPABASE_SERVICE_ROLE_KEY, solo en el servidor y fuera del repositorio). Sin ella no hace nada
 * y devuelve false: los datos de la aplicación igual se eliminan, pero la identidad de acceso queda.
 */
export async function deleteAuthIdentity(supabaseId: string | null): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseId) return false;

  const { url } = getSupabaseConfig();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(supabaseId);
  return !error;
}
