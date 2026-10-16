// Decisión pura de "eliminar la identidad de Supabase Auth" (sin red ni env): el cliente real se inyecta en `remove`.
// Distingue "no se intentó" (sin clave o sin id) de "se intentó y falló", para que el fallo no pase en silencio.

export type IdentityDeletion = { status: 'deleted' } | { status: 'skipped' } | { status: 'failed'; detail: string }

export type DeleteIdentityDeps = {
  serviceKey: string | undefined
  supabaseId: string | null
  remove: (supabaseId: string) => Promise<{ error: { message: string } | null }>
}

export async function deleteIdentityWith({ serviceKey, supabaseId, remove }: DeleteIdentityDeps): Promise<IdentityDeletion> {
  if (!serviceKey || !supabaseId) return { status: 'skipped' }
  try {
    const { error } = await remove(supabaseId)
    return error ? { status: 'failed', detail: error.message } : { status: 'deleted' }
  } catch (caught) {
    return { status: 'failed', detail: caught instanceof Error ? caught.message : 'error desconocido' }
  }
}
