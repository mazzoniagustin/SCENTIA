-- Bucket privado para las fotos de los perfumes propios.
-- La ruta de cada archivo es "{supabaseId}/{uuid}.webp": la primera carpeta es el id de Supabase de la persona (auth.uid()).
-- NO lleva políticas sobre storage.objects a propósito: la aplicación sube con un token firmado que entrega el servidor, lee con URLs
-- firmadas y borra con la clave de servicio, así que el acceso directo con la sesión de la persona queda denegado por defecto (ver
-- 2026-10-21-private-perfumes-storage-lock.sql, que quita las políticas de la primera versión de este archivo en una base que ya las tenía).
-- Se aplica a mano en el SQL Editor de Supabase.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('private-perfumes', 'private-perfumes', false, 307200, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Reversión (vaciar antes el bucket desde el panel):
--   DELETE FROM storage.buckets WHERE id = 'private-perfumes';
