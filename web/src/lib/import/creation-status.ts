// Estado de publicación con el que se CREAN los perfumes nuevos en los imports.
// Sin --as-draft no se fija nada (rige el default del schema, PUBLISHED); con él, los nuevos entran como DRAFT.
// Solo se usa en el create: los perfumes existentes nunca cambian de estado.
export function creationStatus(asDraft: boolean): { status?: 'DRAFT' } {
  return asDraft ? { status: 'DRAFT' } : {}
}
