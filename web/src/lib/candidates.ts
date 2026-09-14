import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { PerfumeWithRelations } from '@/lib/similarity'

// Candidato a recomendación: un perfume con relaciones de acordes/notas
// cargadas (para poder puntuarlo) y los campos editoriales mínimos para la
// respuesta.
export type Candidate = PerfumeWithRelations & {
  brand: string
  name: string
}

// Recupera solo los perfumes que comparten al menos un acorde o una nota con
// la referencia. El filtro anidado `some` se traduce a subconsultas indexadas
// (índices sobre PerfumeAccord.accordId y PerfumeNote.noteId), de modo que el
// volumen traído es proporcional a la coincidencia, nunca al catálogo completo.
export async function fetchCandidates(referenceId: string): Promise<Candidate[]> {
  const reference = await prisma.perfume.findUnique({
    where: { id: referenceId },
    select: {
      accords: { select: { accordId: true } },
      notes: { select: { noteId: true } },
    },
  })
  if (!reference) return []

  const accordIds = reference.accords.map((accord) => accord.accordId)
  const noteIds = reference.notes.map((note) => note.noteId)

  const or: Prisma.PerfumeWhereInput[] = []
  if (accordIds.length > 0) {
    or.push({ accords: { some: { accordId: { in: accordIds } } } })
  }
  if (noteIds.length > 0) {
    or.push({ notes: { some: { noteId: { in: noteIds } } } })
  }
  // Referencia sin acordes ni notas: no hay base para recomendar nada.
  if (or.length === 0) return []

  return prisma.perfume.findMany({
    where: { id: { not: referenceId }, OR: or },
    select: {
      id: true,
      brand: true,
      name: true,
      accords: { select: { accordId: true, intensity: true } },
      notes: { select: { noteId: true, noteType: true } },
    },
  })
}