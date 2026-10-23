-- Links para compartir la colección (vista pública de solo lectura): uno por persona y por lista (OWNED o WISHLIST).
-- Aditivo: crea un tipo y una tabla nuevos, no modifica filas existentes. Se guarda solo el hash del token, nunca el token.
-- Prisma no conoce el CHECK: se aplica a mano con este archivo (no con `db push`).
-- Sin políticas de RLS, como el resto del esquema: solo accede el servidor.
-- Aplicar dentro de una transacción, con respaldo previo (npx tsx scripts/backup-db.ts).

BEGIN;

CREATE TYPE "ShareScope" AS ENUM ('OWNED', 'WISHLIST');

CREATE TABLE "CollectionShare" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "scope"       "ShareScope" NOT NULL,
  "showRatings" BOOLEAN      NOT NULL DEFAULT false,
  "tokenHash"   TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionShare_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- Las calificaciones solo se pueden mostrar en la lista de perfumes que la persona tiene.
  CONSTRAINT "CollectionShare_ratings_only_owned" CHECK ("showRatings" = false OR "scope" = 'OWNED')
);

CREATE UNIQUE INDEX "CollectionShare_userId_scope_key" ON "CollectionShare" ("userId", "scope");
CREATE UNIQUE INDEX "CollectionShare_tokenHash_key" ON "CollectionShare" ("tokenHash");

ALTER TABLE "CollectionShare" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Reversión:
--   BEGIN;
--   DROP TABLE "CollectionShare";
--   DROP TYPE "ShareScope";
--   COMMIT;
