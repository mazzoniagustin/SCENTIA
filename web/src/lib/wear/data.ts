import { prisma } from '@/lib/prisma'
import { isValidPerfumeId } from '@/lib/collection/validation'
import { dayKey } from '@/lib/daily/daily'
import { summarizeStreak, type StreakSummary } from '@/lib/streak/streak'

// Registro diario de uso y racha. Todo parte del userId de la sesión del servidor, nunca de uno del cliente.
// Solo se puede registrar el día en curso (hora de Buenos Aires) y perfumes de la propia colección que se usan:
// los que se tienen (OWNED) o se probaron en muestra (SAMPLED).

export const WEARABLE_STATUSES = ['OWNED', 'SAMPLED'] as const

export type WearToday = { perfumeId: string; brand: string; name: string }

export type WearSummary = {
  streak: StreakSummary
  today: WearToday | null
  day: string
}

export async function getWearSummary(userId: string, now: Date = new Date()): Promise<WearSummary> {
  const day = dayKey(now)
  const [logs, todayLog] = await Promise.all([
    prisma.wearLog.findMany({ where: { userId }, select: { day: true } }),
    prisma.wearLog.findUnique({
      where: { userId_day: { userId, day } },
      select: { perfume: { select: { id: true, brand: true, name: true } } },
    }),
  ])
  return {
    streak: summarizeStreak(logs.map((l) => l.day), day),
    today: todayLog ? { perfumeId: todayLog.perfume.id, brand: todayLog.perfume.brand, name: todayLog.perfume.name } : null,
    day,
  }
}

/** Perfumes de la colección que se pueden registrar como "uso de hoy". */
export async function getWearOptions(userId: string): Promise<Array<{ perfumeId: string; brand: string; name: string }>> {
  const rows = await prisma.userCollection.findMany({
    where: { userId, status: { in: [...WEARABLE_STATUSES] } },
    select: { perfume: { select: { id: true, brand: true, name: true } } },
    orderBy: [{ perfume: { brand: 'asc' } }, { perfume: { name: 'asc' } }],
  })
  return rows.map((r) => ({ perfumeId: r.perfume.id, brand: r.perfume.brand, name: r.perfume.name }))
}

/** Cuántos perfumes tiene la persona en su colección y cuántos se pueden registrar como uso de hoy. */
export async function getCollectionOverview(userId: string): Promise<{ total: number; wearable: number }> {
  const [total, wearable] = await Promise.all([
    prisma.userCollection.count({ where: { userId } }),
    prisma.userCollection.count({ where: { userId, status: { in: [...WEARABLE_STATUSES] } } }),
  ])
  return { total, wearable }
}

export type LogWearResult = { ok: true } | { ok: false; error: 'invalid' | 'not_in_collection' }

/** Registra (o cambia) el perfume de hoy. Un perfume por día. */
export async function logWearToday(userId: string, perfumeId: unknown, now: Date = new Date()): Promise<LogWearResult> {
  if (!isValidPerfumeId(perfumeId)) return { ok: false, error: 'invalid' }

  const owned = await prisma.userCollection.findUnique({
    where: { userId_perfumeId: { userId, perfumeId } },
    select: { status: true },
  })
  if (!owned || !(WEARABLE_STATUSES as readonly string[]).includes(owned.status)) {
    return { ok: false, error: 'not_in_collection' }
  }

  const day = dayKey(now)
  await prisma.wearLog.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, perfumeId },
    update: { perfumeId },
  })
  return { ok: true }
}
