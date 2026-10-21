// Operaciones sobre el bucket de fotos de perfumes propios, escritas contra una interfaz mínima (`PhotoBucket`) para poder
// probarlas sin red. `storage.ts` las conecta con el cliente real de Supabase. Ninguna lanza: un fallo de Storage nunca debe
// romper una pantalla; se degrada (sin foto) y la causa se registra en quien llama.

/** Vigencia de las URLs de lectura (spec: 1 hora). */
export const SIGNED_URL_SECONDS = 3600

type StorageResult<T> = Promise<{ data: T | null; error: unknown }>

/** Subconjunto de `supabase.storage.from(bucket)` que usa la aplicación. */
export type PhotoBucket = {
  createSignedUploadUrl(path: string, options?: { upsert: boolean }): StorageResult<{ token: string; path: string }>
  createSignedUrls(paths: string[], expiresIn: number): StorageResult<Array<{ path: string | null; signedUrl: string; error: string | null }>>
  list(folder: string, options: { search?: string; limit: number; offset?: number }): StorageResult<Array<{ name: string; metadata?: { size?: number } | null }>>
  remove(paths: string[]): StorageResult<unknown>
}

/** ruta → URL firmada. Las rutas que no se pueden firmar (o si Storage falla) simplemente no aparecen. */
export async function signPhotoUrlsWith(bucket: PhotoBucket, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)]
  const signed = new Map<string, string>()
  if (unique.length === 0) return signed
  try {
    const { data, error } = await bucket.createSignedUrls(unique, SIGNED_URL_SECONDS)
    if (error || !data) return signed
    for (const item of data) if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl)
  } catch {
    // Sin foto firmada se muestra la portada generada.
  }
  return signed
}

/** Si el archivo existe en Storage y cuánto pesa. */
export async function photoExistsIn(bucket: PhotoBucket, path: string): Promise<{ exists: boolean; bytes: number }> {
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const file = path.slice(slash + 1)
  try {
    const { data, error } = await bucket.list(folder, { search: file, limit: 10 })
    if (error || !data) return { exists: false, bytes: 0 }
    const found = data.find((item) => item.name === file)
    return found ? { exists: true, bytes: found.metadata?.size ?? 0 } : { exists: false, bytes: 0 }
  } catch {
    return { exists: false, bytes: 0 }
  }
}

/** Borra los archivos; devuelve false si Storage falló (quien llama decide si registrarlo). */
export async function removePhotosFrom(bucket: PhotoBucket, paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true
  try {
    const { error } = await bucket.remove(paths)
    return !error
  } catch {
    return false
  }
}

/** Archivos por página al listar una carpeta, y tope de páginas (una persona no llega ni cerca; evita un ciclo sin fin). */
export const LIST_PAGE_SIZE = 100
const MAX_LIST_PAGES = 100

/** Rutas completas de todos los archivos de una carpeta (recorre las páginas). Ante un fallo devuelve lo que alcanzó a listar. */
export async function listFolderPaths(bucket: PhotoBucket, folder: string): Promise<string[]> {
  const names = new Set<string>()
  try {
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const { data, error } = await bucket.list(folder, { limit: LIST_PAGE_SIZE, offset: page * LIST_PAGE_SIZE })
      if (error || !data) break
      const before = names.size
      for (const item of data) names.add(item.name)
      if (data.length < LIST_PAGE_SIZE || names.size === before) break
    }
  } catch {
    // Se devuelve lo que se alcanzó a listar.
  }
  return [...names].map((name) => `${folder}/${name}`)
}
