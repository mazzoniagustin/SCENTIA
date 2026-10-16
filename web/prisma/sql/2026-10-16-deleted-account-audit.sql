-- Resumen anónimo de cuentas eliminadas (RF-05; ver docs/retencion-eliminacion-cuenta.md).
-- Aditivo: crea dos tablas nuevas, no modifica filas ni tablas existentes. Sin datos personales: id propio (no el User.id),
-- fechas solo como mes (YYYY-MM), sin correo, notas ni quiz.
-- Prisma conoce los modelos, pero se aplican a mano con este archivo (no con `db push`).
-- Aplicar con respaldo previo (npx tsx scripts/backup-db.ts) y con confirmación de la persona propietaria.

BEGIN;

CREATE TABLE "DeletedAccountAudit" (
  "id"              TEXT PRIMARY KEY,
  "signedUpMonth"   TEXT    NOT NULL,
  "deletedMonth"    TEXT    NOT NULL,
  "collectionTotal" INTEGER NOT NULL,
  "ownedCount"      INTEGER NOT NULL,
  "sampledCount"    INTEGER NOT NULL,
  "wishlistCount"   INTEGER NOT NULL,
  "dislikedCount"   INTEGER NOT NULL,
  "ratingsCount"    INTEGER NOT NULL,
  "ratingsSum"      INTEGER NOT NULL,
  "longestStreak"   INTEGER NOT NULL,
  "wearDaysTotal"   INTEGER NOT NULL,
  "hadQuizProfile"  BOOLEAN NOT NULL,
  "policyVersion"   INTEGER NOT NULL
);

-- Sin FK a "Perfume": si un perfume sale del catálogo, el histórico no se pierde ni bloquea nada.
CREATE TABLE "DeletedAccountCollection" (
  "auditId"   TEXT NOT NULL,
  "perfumeId" TEXT NOT NULL,
  "status"    "CollectionStatus" NOT NULL,
  "rating"    INTEGER,
  PRIMARY KEY ("auditId", "perfumeId"),
  CONSTRAINT "DeletedAccountCollection_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "DeletedAccountAudit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DeletedAccountCollection_perfumeId_idx" ON "DeletedAccountCollection" ("perfumeId");

-- RLS sin políticas (deny-all para la API REST de Supabase); la app conecta como `postgres`.
ALTER TABLE "DeletedAccountAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeletedAccountCollection" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Reversión:
--   DROP TABLE "DeletedAccountCollection", "DeletedAccountAudit";
