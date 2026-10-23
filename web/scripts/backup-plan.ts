// Qué tablas (y qué filas) incluye el respaldo y en qué orden se restauran. Lógica pura, compartida por backup-db.ts y restore-db.ts.

/** Restauración por claves foráneas: primero las tablas de las que dependen otras. `User` va antes que `Perfume`: los perfumes propios
 *  (Perfume.ownerId) apuntan a una persona; `CollectionShare` también va después de `User`. */
export const RESTORE_ORDER = ['Accord', 'Note', 'User', 'Perfume', 'PerfumeAccord', 'PerfumeNote', 'UserCollection', 'UserProfile', 'CollectionShare']

/** Lo irreemplazable de las personas (el catálogo se puede regenerar con los scripts de importación). */
export const USER_DATA_TABLES = ['User', 'UserCollection', 'UserProfile', 'CollectionShare']

/** Los perfumes propios sí son irreemplazables: no vienen de ninguna importación. */
export const OWN_PERFUME_WHERE = 'WHERE t."ownerId" IS NOT NULL'
export const OWN_ACCORD_WHERE = 'WHERE t."perfumeId" IN (SELECT id FROM "Perfume" WHERE "ownerId" IS NOT NULL)'

export type TableSelection = { table: string; where: string }

/** Tablas a respaldar, en el orden dado, con el filtro de filas de cada una ('' = todas). `onlyUsers`: solo datos de personas. */
export function selectionFor(allTables: readonly string[], onlyUsers: boolean): TableSelection[] {
  if (!onlyUsers) return allTables.map((table) => ({ table, where: '' }))
  const wanted: TableSelection[] = [
    ...USER_DATA_TABLES.map((table) => ({ table, where: '' })),
    { table: 'Perfume', where: OWN_PERFUME_WHERE },
    { table: 'PerfumeAccord', where: OWN_ACCORD_WHERE },
  ]
  return wanted.filter((w) => allTables.includes(w.table)).sort((a, b) => allTables.indexOf(a.table) - allTables.indexOf(b.table))
}
