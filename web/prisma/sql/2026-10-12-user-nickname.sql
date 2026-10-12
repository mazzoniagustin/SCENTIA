-- Apodo público de la persona (registro con magic link).
-- Aditivo: no modifica filas existentes (los apodos quedan en NULL y los NULL no chocan en el índice único).
-- Prisma no conoce el índice sobre lower() ni el CHECK: se aplican a mano con este archivo (no con `db push`).
-- Aplicar dentro de una transacción, con respaldo previo (npx tsx scripts/backup-db.ts).

BEGIN;

ALTER TABLE "UserProfile" ADD COLUMN "nickname" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "nicknameIsTemporary" BOOLEAN NOT NULL DEFAULT false;

-- Unicidad sin distinguir mayúsculas.
CREATE UNIQUE INDEX "UserProfile_nickname_lower_key" ON "UserProfile" (lower("nickname"));

-- Formato en la base como defensa en profundidad (la validación real vive en src/lib/account/nickname.ts).
ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_nickname_format"
  CHECK ("nickname" IS NULL OR "nickname" ~ '^[A-Za-z0-9_-]{3,20}$');

COMMIT;

-- Reversión:
--   BEGIN;
--   ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_nickname_format";
--   DROP INDEX "UserProfile_nickname_lower_key";
--   ALTER TABLE "UserProfile" DROP COLUMN "nicknameIsTemporary";
--   ALTER TABLE "UserProfile" DROP COLUMN "nickname";
--   COMMIT;
