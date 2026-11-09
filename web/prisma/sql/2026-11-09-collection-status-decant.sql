-- Nuevo estado de colección "Tengo un decant" (DECANT). Cuenta para la racha, igual que OWNED; SAMPLED ya no.
-- Aditivo: no modifica filas existentes. ALTER TYPE ... ADD VALUE no puede correr dentro de una transacción en versiones viejas de Postgres.
-- Aplicar con respaldo previo (npx tsx scripts/backup-db.ts).

ALTER TYPE "CollectionStatus" ADD VALUE IF NOT EXISTS 'DECANT' AFTER 'OWNED';
