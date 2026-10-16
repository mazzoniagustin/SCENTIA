import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";
import { logServerError } from "@/lib/log";
import { deleteIdentityWith, type IdentityDeletion } from "./delete-identity";

/**
 * Elimina la identidad de Supabase Auth de la persona. Necesita la clave de servicio
 * (SUPABASE_SERVICE_ROLE_KEY, solo en el servidor y fuera del repositorio). Sin ella no hace nada
 * (`skipped`): los datos de la aplicación igual se eliminan, pero la identidad de acceso queda.
 * Un fallo (`failed`) se registra en el log del servidor sin la clave.
 */
export async function deleteAuthIdentity(supabaseId: string | null): Promise<IdentityDeletion> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey && supabaseId) console.warn("[supabase/delete-identity] SUPABASE_SERVICE_ROLE_KEY no está configurada: la identidad de Auth no se eliminó");
  const result = await deleteIdentityWith({
    serviceKey,
    supabaseId,
    remove: (id) => {
      const { url } = getSupabaseConfig();
      const admin = createClient(url, serviceKey as string, { auth: { persistSession: false, autoRefreshToken: false } });
      return admin.auth.admin.deleteUser(id);
    },
  });
  if (result.status === 'failed') logServerError("supabase/delete-identity", new Error(result.detail));
  return result;
}
