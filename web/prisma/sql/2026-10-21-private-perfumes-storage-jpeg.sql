-- Permite JPEG además de WebP en el bucket "private-perfumes".
-- Safari en iOS no puede codificar WebP en un canvas, así que desde el iPhone el navegador sube la foto achicada como JPEG
-- (ruta "{supabaseId}/{uuid}.jpg"). Se aplica a mano en el SQL Editor de Supabase.

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp', 'image/jpeg']
WHERE id = 'private-perfumes';

COMMIT;

-- Verificación posterior (debe devolver {image/webp,image/jpeg}):
--   SELECT allowed_mime_types FROM storage.buckets WHERE id = 'private-perfumes';
-- Reversión (borrar antes las fotos .jpg del bucket):
--   UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/webp'] WHERE id = 'private-perfumes';
