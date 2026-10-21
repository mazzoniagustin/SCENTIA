-- Cierra el acceso directo al bucket "private-perfumes" con la sesión de la persona.
-- La aplicación no usa esas políticas: sube con un token de un solo uso que entrega el servidor, lee con URLs firmadas y borra con la
-- clave de servicio (que ignora las políticas). Con políticas de escritura, cualquier sesión podía subir, pisar o borrar archivos de su
-- carpeta con la clave publicable, salteándose el límite de frecuencia y la verificación de ruta de las acciones del servidor.
-- Sin políticas, el acceso directo queda denegado por defecto. Aplicar a mano en el SQL Editor de Supabase.

BEGIN;

DROP POLICY IF EXISTS "private_perfumes_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "private_perfumes_update_own" ON storage.objects;
DROP POLICY IF EXISTS "private_perfumes_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "private_perfumes_select_own" ON storage.objects;

COMMIT;

-- Verificación posterior (debe devolver 0 filas):
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects' AND (qual ILIKE '%private-perfumes%' OR with_check ILIKE '%private-perfumes%');
