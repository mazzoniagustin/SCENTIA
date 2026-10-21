-- Perfumes propios de cada persona (privados, solo en su colección).
-- Aditivo salvo el índice único de (brand, name): pasa de global a parcial (solo catálogo, ownerId IS NULL) y se agrega uno por persona.
-- Prisma no conoce los índices parciales ni el CHECK: se aplican a mano con este archivo (no con `db push`).
-- Aplicar con respaldo previo (npx tsx scripts/backup-db.ts). Dos pasos: el valor nuevo del enum tiene que estar confirmado
-- (COMMIT) antes de usarlo en el CHECK. En el SQL Editor de Supabase hay que ejecutarlo en DOS ejecuciones separadas: primero
-- solo el Paso 1 y después el Paso 2 (si no, falla con 55P04 "unsafe use of new value").

-- Paso 1 (fuera de la transacción).
ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'PRIVATE';

-- Paso 2.
BEGIN;

ALTER TABLE "Perfume" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Perfume"
  ADD CONSTRAINT "Perfume_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Perfume_ownerId_idx" ON "Perfume" ("ownerId");

-- Notas libres de los perfumes propios (no se tocan la tabla global "Note").
ALTER TABLE "Perfume" ADD COLUMN "topNotes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Perfume" ADD COLUMN "heartNotes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Perfume" ADD COLUMN "baseNotes" TEXT[] NOT NULL DEFAULT '{}';

-- Unicidad: catálogo (sin dueño) y, aparte, por persona sin distinguir mayúsculas.
DROP INDEX "Perfume_brand_name_key";
CREATE UNIQUE INDEX "Perfume_brand_name_catalog_key" ON "Perfume" ("brand", "name") WHERE "ownerId" IS NULL;
CREATE UNIQUE INDEX "Perfume_owner_brand_name_key" ON "Perfume" ("ownerId", lower("brand"), lower("name")) WHERE "ownerId" IS NOT NULL;

-- Un perfume privado siempre tiene dueño.
ALTER TABLE "Perfume"
  ADD CONSTRAINT "Perfume_private_has_owner" CHECK ("status" <> 'PRIVATE' OR "ownerId" IS NOT NULL);

COMMIT;

-- Reversión (borrar antes los perfumes con "ownerId" no nulo, o el índice único del catálogo puede chocar):
--   BEGIN;
--   DELETE FROM "Perfume" WHERE "ownerId" IS NOT NULL;
--   ALTER TABLE "Perfume" DROP CONSTRAINT "Perfume_private_has_owner";
--   DROP INDEX "Perfume_owner_brand_name_key";
--   DROP INDEX "Perfume_brand_name_catalog_key";
--   CREATE UNIQUE INDEX "Perfume_brand_name_key" ON "Perfume" ("brand", "name");
--   ALTER TABLE "Perfume" DROP COLUMN "baseNotes", DROP COLUMN "heartNotes", DROP COLUMN "topNotes";
--   DROP INDEX "Perfume_ownerId_idx";
--   ALTER TABLE "Perfume" DROP CONSTRAINT "Perfume_ownerId_fkey";
--   ALTER TABLE "Perfume" DROP COLUMN "ownerId";
--   COMMIT;
-- (El valor 'PRIVATE' del enum no se puede quitar; queda sin uso.)
