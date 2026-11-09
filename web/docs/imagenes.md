# Imágenes de perfumes

## Cómo funcionan

- Las fotos de los frascos se **enlazan** desde su origen (hotlink): Scentia **no las descarga ni las aloja**, y no usa la
  optimización de imágenes de Vercel (no pasan por nuestro servidor ni se cachean copias).
- Columnas de `Perfume`: `imageUrl` (URL de la foto), `imageSource` (nombre de la fuente, ej. `Fragrantica`) e `imageSourceUrl`
  (página de origen, para el crédito en la ficha).
- Solo se muestran URLs `https` de un host permitido (`ALLOWED_IMAGE_HOSTS` en `src/lib/images.ts`, hoy solo `fimgs.net`).
  Cualquier otra URL se ignora y se muestra la portada generada.
- `PerfumeImage` (`src/app/perfumes/PerfumeImage.tsx`) se usa en el catálogo, las marcas, la ficha, el comparador, el quiz, Mi colección,
  el perfume del día y los carruseles. Si no hay foto, la URL no es válida o la imagen falla al cargar, muestra la portada generada.
- `/creditos` explica el origen de las imágenes y, si está definida `NEXT_PUBLIC_CONTACT_EMAIL`, el correo para pedir un retiro.

## Cargar las URLs (backfill)

Sin requests de red: lee `data/perfumes.jsonl` (dataset de Kaggle, local).

```sh
npx tsx scripts/backfill-perfume-images.ts --dry-run   # simulación (también sin flags)
npx tsx scripts/backfill-perfume-images.ts --apply
```

Es idempotente: solo completa filas con `imageSource` vacío.

## Retirar una imagen puntual

Si un titular lo pide, ocultar la foto de ese perfume (se muestra la portada generada). Hay que dejar `imageSource = 'removed'`:
así el backfill no la vuelve a cargar al repetirse.

```sql
UPDATE "Perfume"
SET "imageUrl" = NULL, "imageSourceUrl" = NULL, "imageSource" = 'removed'
WHERE id = '<id del perfume>';   -- o: WHERE "sourceId" = '<id en Fragrantica>'
```

Para retirar **todas** las fotos (por ejemplo ante un pedido general):

```sql
UPDATE "Perfume" SET "imageUrl" = NULL, "imageSourceUrl" = NULL, "imageSource" = 'removed' WHERE "imageUrl" IS NOT NULL;
```

Para volver a mostrar una imagen: `UPDATE "Perfume" SET "imageSource" = NULL WHERE id = '<id>';` y correr el backfill con `--apply`.
La caché de listados dura hasta 1 hora, así que el cambio puede tardar en verse en todas las páginas.

## Variables de entorno

- `NEXT_PUBLIC_CONTACT_EMAIL`: correo de contacto para retiros. Cargarla en Vercel (Settings → Environment Variables) y redesplegar,
  porque las variables `NEXT_PUBLIC_*` se incorporan al compilar.
