import 'server-only'

import { prisma } from '@/lib/prisma'
import type { CollectionEntryInput } from '@/lib/collection/validation'
import type { PrivatePerfumeInput } from './validation'

// Perfumes propios (status PRIVATE): solo viven en la colección de su dueño. Todo parte del userId de la sesión del servidor,
// nunca de uno del cliente, y toda consulta filtra por `ownerId`. Los datos ya deben venir validados.

/** Intensidad con la que se guarda un acorde elegido por la persona (no hay votos de comunidad). */
export const OWN_ACCORD_INTENSITY = 70

/** Entrada de colección sin el id del perfume (se conoce al crearlo). */
export type OwnCollectionEntry = Omit<CollectionEntryInput, 'perfumeId'>

export type OwnPrivatePerfume = {
  id: string
  name: string
  brand: string
  perfumer: string | null
  gender: string
  description: string | null
  topNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
  longevity: number | null
  sillage: number | null
  /** Ruta de la foto en Storage; para mostrarla hay que firmarla. */
  imagePath: string | null
  accords: Array<{ id: string; name: string; intensity: number }>
  entry: { status: string; rating: number | null; personalNotes: string | null }
}

/** Violación de la unicidad por persona (misma marca y nombre, sin distinguir mayúsculas). */
export function isDuplicatePerfumeError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}

const perfumeFields = (input: PrivatePerfumeInput) => ({
  brand: input.brand,
  name: input.name,
  gender: input.gender,
  perfumer: input.perfumer,
  description: input.description,
  topNotes: input.topNotes,
  heartNotes: input.heartNotes,
  baseNotes: input.baseNotes,
  longevity: input.longevity,
  sillage: input.sillage,
})

async function assertAccordsExist(accordIds: string[]) {
  if (accordIds.length === 0) return
  const found = await prisma.accord.count({ where: { id: { in: accordIds } } })
  if (found !== accordIds.length) throw new Error('Algún acorde elegido no existe')
}

const accordRows = (perfumeId: string, accordIds: string[]) =>
  accordIds.map((accordId) => ({ perfumeId, accordId, intensity: OWN_ACCORD_INTENSITY }))

/** Crea el perfume, sus acordes y su entrada de colección en una sola transacción. */
export async function createPrivatePerfume(
  userId: string,
  perfumeId: string,
  imagePath: string,
  input: PrivatePerfumeInput,
  entry: OwnCollectionEntry,
): Promise<{ id: string }> {
  await assertAccordsExist(input.accordIds)
  return prisma.$transaction(async (tx) => {
    await tx.perfume.create({
      data: { id: perfumeId, ...perfumeFields(input), status: 'PRIVATE', ownerId: userId, imageUrl: imagePath },
    })
    await tx.perfumeAccord.createMany({ data: accordRows(perfumeId, input.accordIds) })
    await tx.userCollection.create({
      data: { userId, perfumeId, status: entry.status, rating: entry.rating ?? null, personalNotes: entry.personalNotes ?? null },
    })
    return { id: perfumeId }
  })
}

/**
 * Reemplaza los datos, los acordes y la entrada de colección. `imagePath` undefined conserva la foto actual.
 * Devuelve false si el perfume no existe o no es de esa persona.
 */
export async function updatePrivatePerfume(
  userId: string,
  perfumeId: string,
  imagePath: string | undefined,
  input: PrivatePerfumeInput,
  entry: OwnCollectionEntry,
): Promise<boolean> {
  await assertAccordsExist(input.accordIds)
  return prisma.$transaction(async (tx) => {
    const updated = await tx.perfume.updateMany({
      where: { id: perfumeId, ownerId: userId, status: 'PRIVATE' },
      data: { ...perfumeFields(input), ...(imagePath !== undefined ? { imageUrl: imagePath } : {}) },
    })
    if (updated.count === 0) return false
    await tx.perfumeAccord.deleteMany({ where: { perfumeId } })
    await tx.perfumeAccord.createMany({ data: accordRows(perfumeId, input.accordIds) })
    const data = { status: entry.status, rating: entry.rating ?? null, personalNotes: entry.personalNotes ?? null }
    await tx.userCollection.upsert({
      where: { userId_perfumeId: { userId, perfumeId } },
      update: data,
      create: { userId, perfumeId, ...data },
    })
    return true
  })
}

export async function getOwnPrivatePerfume(userId: string, perfumeId: string): Promise<OwnPrivatePerfume | null> {
  const row = await prisma.perfume.findFirst({
    where: { id: perfumeId, ownerId: userId, status: 'PRIVATE' },
    select: {
      id: true, name: true, brand: true, perfumer: true, gender: true, description: true,
      topNotes: true, heartNotes: true, baseNotes: true, longevity: true, sillage: true, imageUrl: true,
      accords: { select: { intensity: true, accord: { select: { id: true, name: true } } }, orderBy: { accord: { name: 'asc' } } },
      collectedBy: { where: { userId }, select: { status: true, rating: true, personalNotes: true } },
    },
  })
  if (!row) return null
  const { imageUrl, accords, collectedBy, ...rest } = row
  const entry = collectedBy[0] ?? { status: 'OWNED', rating: null, personalNotes: null }
  return {
    ...rest,
    imagePath: imageUrl,
    accords: accords.map((a) => ({ id: a.accord.id, name: a.accord.name, intensity: a.intensity })),
    entry,
  }
}

/** Borra el perfume (sus acordes, su colección y su racha caen en cascada). Devuelve la ruta de la foto, o null si no era suyo. */
export async function deletePrivatePerfume(userId: string, perfumeId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.perfume.findFirst({ where: { id: perfumeId, ownerId: userId, status: 'PRIVATE' }, select: { imageUrl: true } })
    if (!row) return null
    await tx.perfume.delete({ where: { id: perfumeId } })
    return row.imageUrl ?? ''
  })
}

/** Rutas de todas las fotos de la persona: para borrarlas de Storage al eliminar la cuenta. */
export async function listOwnPhotoPaths(userId: string): Promise<string[]> {
  const rows = await prisma.perfume.findMany({ where: { ownerId: userId, status: 'PRIVATE', imageUrl: { not: null } }, select: { imageUrl: true } })
  return rows.map((r) => r.imageUrl as string)
}
