// Lectura de listas de ids (un id por línea). Lógica pura: sin Prisma ni server-only.

/** Interpreta el texto de un archivo de ids: ignora líneas vacías y comentarios `#` (línea completa o al final). */
export function parseIdList(text: string): string[] {
  const ids: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (line) ids.push(line)
  }
  return ids
}
