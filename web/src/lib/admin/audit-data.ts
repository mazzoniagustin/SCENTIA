import 'server-only'

// Lectura de la auditoría para el superadmin. Solo agregados: conteos, sumas y promedios. Nunca correos, nombres, apodos,
// ids de personas ni notas. Solo lectura. Las cuentas eliminadas salen del resumen anónimo (docs/retencion-eliminacion-cuenta.md).

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { buildTimeline, pageCount, totalsByStatus, type SavedFilters, type StatusTotals, type TimelineRow } from './audit-report'

export type TopPerfume = { id: string; brand: string; name: string; count: number }

export type AuditData = {
  generatedAt: string
  accounts: { active: number; deleted: number }
  timeline: TimelineRow[]
  /** Colecciones de cuentas activas. */
  liveCollections: StatusTotals & { ratingsCount: number; ratingsSum: number; accountsWithCollection: number }
  /** Resumen anónimo de las cuentas eliminadas. */
  deletedCollections: StatusTotals & { ratingsCount: number; ratingsSum: number }
  deletedActivity: { longestStreakMax: number; longestStreakSum: number; wearDaysTotal: number; withQuizProfile: number }
  live: { quizProfiles: number; wearLogs: number }
  topPerfumes: TopPerfume[]
}

const TOP_LIMIT = 10

export async function getAuditData(): Promise<AuditData> {
  const [
    active,
    liveByMonth,
    liveByStatus,
    liveRatings,
    accountsWithCollection,
    quizProfiles,
    wearLogs,
    deleted,
    deletedByMonth,
    deletedBySignupMonth,
    top,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.$queryRaw<Array<{ month: string; count: number }>>`
      SELECT to_char("createdAt", 'YYYY-MM') AS month, count(*)::int AS count FROM "User" GROUP BY 1`,
    prisma.userCollection.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.userCollection.aggregate({ _count: { rating: true }, _sum: { rating: true } }),
    prisma.userCollection.groupBy({ by: ['userId'], _count: { _all: true } }).then((rows) => rows.length),
    prisma.userProfile.count({ where: { quizVersion: { not: null } } }),
    prisma.wearLog.count(),
    prisma.deletedAccountAudit.aggregate({
      _count: { _all: true },
      _sum: {
        collectionTotal: true, ownedCount: true, sampledCount: true, wishlistCount: true, dislikedCount: true,
        ratingsCount: true, ratingsSum: true, longestStreak: true, wearDaysTotal: true,
      },
      _max: { longestStreak: true },
    }),
    prisma.deletedAccountAudit.groupBy({ by: ['deletedMonth'], _count: { _all: true } }),
    prisma.deletedAccountAudit.groupBy({ by: ['signedUpMonth'], _count: { _all: true } }),
    prisma.$queryRaw<Array<{ id: string; brand: string; name: string; count: number }>>`
      SELECT p.id, p.brand, p.name, count(*)::int AS count
      FROM (SELECT "perfumeId" FROM "UserCollection" UNION ALL SELECT "perfumeId" FROM "DeletedAccountCollection") c
      JOIN "Perfume" p ON p.id = c."perfumeId" AND p."ownerId" IS NULL
      GROUP BY p.id, p.brand, p.name
      ORDER BY count DESC, p.id
      LIMIT ${TOP_LIMIT}`,
  ])

  const deletedWithQuiz = await prisma.deletedAccountAudit.count({ where: { hadQuizProfile: true } })
  const sum = deleted._sum

  return {
    generatedAt: new Date().toISOString(),
    accounts: { active, deleted: deleted._count._all },
    // Altas = cuentas activas por mes de alta + cuentas ya eliminadas por su mes de alta. Bajas = por mes de eliminación.
    timeline: buildTimeline(
      [...liveByMonth, ...deletedBySignupMonth.map((r) => ({ month: r.signedUpMonth, count: r._count._all }))],
      deletedByMonth.map((r) => ({ month: r.deletedMonth, count: r._count._all })),
    ),
    liveCollections: {
      ...totalsByStatus(liveByStatus.map((r) => ({ status: r.status, count: r._count._all }))),
      ratingsCount: liveRatings._count.rating,
      ratingsSum: liveRatings._sum.rating ?? 0,
      accountsWithCollection,
    },
    deletedCollections: {
      owned: sum.ownedCount ?? 0,
      sampled: sum.sampledCount ?? 0,
      wishlist: sum.wishlistCount ?? 0,
      disliked: sum.dislikedCount ?? 0,
      total: sum.collectionTotal ?? 0,
      ratingsCount: sum.ratingsCount ?? 0,
      ratingsSum: sum.ratingsSum ?? 0,
    },
    deletedActivity: {
      longestStreakMax: deleted._max.longestStreak ?? 0,
      longestStreakSum: sum.longestStreak ?? 0,
      wearDaysTotal: sum.wearDaysTotal ?? 0,
      withQuizProfile: deletedWithQuiz,
    },
    live: { quizProfiles, wearLogs },
    topPerfumes: top,
  }
}

export type SavedPerfume = { id: string; brand: string; name: string; total: number; owned: number; sampled: number; wishlist: number; disliked: number }

export const SAVED_PAGE_SIZE = 50

/**
 * Perfumes del catálogo guardados en alguna colección (activa o eliminada), con el desglose por estado. Sin filtro van de más a
 * menos guardados; con `status` solo entran los que tienen al menos un guardado en ese estado y se ordenan por esa cantidad.
 * Solo conteos por perfume: sin ids de personas. `page` ya viene acotada por quien llama; los filtros, validados (`parseSavedFilters`).
 */
export async function getSavedPerfumes(page: number, filters: SavedFilters = { gender: null, status: null }): Promise<{ rows: SavedPerfume[]; totalPerfumes: number; pages: number }> {
  const offset = (Math.max(page, 1) - 1) * SAVED_PAGE_SIZE
  const genderWhere = filters.gender ? Prisma.sql`AND p.gender = ${filters.gender}` : Prisma.empty
  const statusHaving = filters.status ? Prisma.sql`HAVING count(*) FILTER (WHERE c.status = ${filters.status}) > 0` : Prisma.empty
  const statusWhere = filters.status ? Prisma.sql`AND c.status = ${filters.status}` : Prisma.empty
  const sortCount = filters.status ? Prisma.sql`count(*) FILTER (WHERE c.status = ${filters.status})` : Prisma.sql`count(*)`
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<SavedPerfume[]>`
      SELECT p.id, p.brand, p.name,
             count(*)::int AS total,
             (count(*) FILTER (WHERE c.status = 'OWNED'))::int AS owned,
             (count(*) FILTER (WHERE c.status = 'SAMPLED'))::int AS sampled,
             (count(*) FILTER (WHERE c.status = 'WISHLIST'))::int AS wishlist,
             (count(*) FILTER (WHERE c.status = 'DISLIKED'))::int AS disliked
      FROM (SELECT "perfumeId", status::text AS status FROM "UserCollection"
            UNION ALL SELECT "perfumeId", status::text AS status FROM "DeletedAccountCollection") c
      JOIN "Perfume" p ON p.id = c."perfumeId" AND p."ownerId" IS NULL ${genderWhere}
      GROUP BY p.id, p.brand, p.name
      ${statusHaving}
      ORDER BY ${sortCount} DESC, total DESC, p.brand, p.name, p.id
      LIMIT ${SAVED_PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(DISTINCT c."perfumeId")::int AS count
      FROM (SELECT "perfumeId", status::text AS status FROM "UserCollection"
            UNION ALL SELECT "perfumeId", status::text AS status FROM "DeletedAccountCollection") c
      JOIN "Perfume" p ON p.id = c."perfumeId" AND p."ownerId" IS NULL ${genderWhere}
      WHERE true ${statusWhere}`,
  ])
  const totalPerfumes = count[0]?.count ?? 0
  return { rows, totalPerfumes, pages: pageCount(totalPerfumes, SAVED_PAGE_SIZE) }
}
