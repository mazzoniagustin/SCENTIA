# Flujo editorial (RF-06)

Por diseño (RF-06) no hay rutas, pantallas o permisos administrativos en la app. Los cambios editoriales de estado se hacen con
`scripts/editorial.ts` (o a mano en Supabase Studio). El script es de **simulación por defecto**: solo escribe con `--apply`.

## Cuándo usarlo

- Ocultar al público perfumes concretos (despublicar → `DRAFT`) o volver a mostrarlos (publicar → `PUBLISHED`).
- Revisar qué hay en borrador y de qué fuente viene cada perfume.

El catálogo público solo muestra `PUBLISHED`. Los ids son los de `Perfume.id` (los muestra `list`).

## Comandos

```sh
npx tsx scripts/editorial.ts list [--status draft|published] [--limit N] [--q texto]   # solo lectura; también da conteos por estado y source
npx tsx scripts/editorial.ts publish <id…> | --file ids.txt [--apply] [--force-large]
npx tsx scripts/editorial.ts unpublish <id…> | --file ids.txt [--apply] [--force-large]
```

`ids.txt`: un id por línea; se ignoran líneas vacías y comentarios `#` (de línea completa o al final).

## Pasos

1. **Respaldar**: `npx tsx scripts/backup-db.ts` (el script no lo ejecuta; con `--apply` te lo recuerda).
2. **Listar**: `list --status draft` (o `--q marca`) para elegir los ids.
3. **Simular**: correr `publish`/`unpublish` sin `--apply`. Muestra qué cambiaría, qué ya está en ese estado y qué se rechaza con su motivo.
4. **Aplicar**: repetir con `--apply`. Imprime el resumen, escribe `backups/editorial-<fecha>.jsonl` (id, marca, nombre, estado anterior y nuevo; carpeta ignorada por git) y
   muestra el comando de reversión.
5. **Verificar**: `list` otra vez (conteos por estado) y revisar el catálogo público.
6. **Revertir** si hace falta: el comando inverso (`publish` ↔ `unpublish`) con los mismos ids, que el script imprime.

## Seguridad

- Un id inexistente se rechaza y se informa; el resto sigue. Si hay rechazos, el proceso termina con código 1 (nunca falla en silencio).
- Tope de 500 ids por corrida; para más, `--force-large`.
- Solo cambia filas cuyo estado es distinto del pedido (idempotente); el UPDATE no pisa un cambio concurrente.
- Despublicar siempre es posible. Si despublicás un perfume que alguien tiene en su colección, deja de aparecer en el catálogo público.

## Política de procedencia

Para **publicar**, el perfume debe tener `source` no vacío. Si tiene `imageUrl`, también `imageSource` e `imageSourceUrl`, con
`https` y host permitido (`src/lib/images.ts`). Una imagen retirada a propósito (`imageUrl` NULL e `imageSource = 'removed'`)
no bloquea la publicación. Criterios de imágenes y retiros: ver [imagenes.md](imagenes.md).

## Perfumes nuevos como borrador (`--as-draft`)

- El default del schema es `status = PUBLISHED` (`Perfume.status @default(PUBLISHED)`); **no se cambia**.
- `scripts/import-kaggle-fragrantica.ts` y `scripts/import-fragrantica-batch.ts` aceptan `--as-draft`: el `createMany` de perfumes
  **nuevos** pasa `status: 'DRAFT'`. Sin el flag no se fija `status` y los nuevos quedan `PUBLISHED` por el default.
- Los perfumes **existentes** nunca cambian de estado: el update no toca `status`, así que un re-import tampoco republica lo que se despublicó.
- La lógica del flag vive en `src/lib/import/creation-status.ts` (test: `creation-status.test.ts`).
- En la simulación de `import-kaggle-fragrantica.ts` (por defecto, sin `--apply`) se informa cuántos perfumes nuevos entrarían como `DRAFT`.
  `import-fragrantica-batch.ts` no tiene modo simulación (escribe siempre): usá `--as-draft` con un `--limit` chico y respaldo previo.

### Flujo

1. `npx tsx scripts/import-kaggle-fragrantica.ts --as-draft` (simulación) y luego con `--apply`, previo respaldo (`scripts/backup-db.ts`).
2. `npx tsx scripts/editorial.ts list --status draft` para revisar los borradores.
3. `npx tsx scripts/editorial.ts publish --file <ids.txt>` para publicar los aprobados (exige procedencia; ver la política de arriba).
