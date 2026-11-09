# Identidad visual

La marca (logo y emblema) vive en `public/brand/` y se usa desde un único mapa, `src/lib/brand-assets.ts`. Cada lugar de la página
("slot") se dibuja con `<BrandImage slot="..." />` (`src/components/BrandImage.tsx`, basado en `next/image`) y **no dibuja nada**
si el slot está apagado (`available: false`) o la ruta no es de `/brand/`: sin imágenes rotas ni saltos de diseño. Todas las imágenes
salen del mismo origen (`img-src 'self'` de la CSP).

## Marca: colores y tipografía

Dorado `#C9A55C` sobre fondo `#0E0F10` (casi igual al fondo del sitio, `#0f1011`), serif de contraste alto (estilo Newsreader) en
mayúsculas con espaciado amplio, y la frase "Perfumes con contexto" en cursiva. Los SVG tienen el texto convertido a trazados
(no dependen de fuentes) y no traen scripts, fuentes externas ni imágenes remotas.

## Qué archivo va en cada lugar

| Lugar | Slot | Archivo | Tamaño declarado | Texto alternativo |
| --- | --- | --- | --- | --- |
| Encabezado (reemplaza al texto "Scentia") | `logo` | `public/brand/logo.svg` (horizontal, sin fondo) | 235 x 75 (se muestra a 2,5 rem / 3 rem de alto) | "Scentia" |
| Portada, arriba del título | `hero` | `public/brand/logo-stacked.svg` (vertical con frase, sin fondo) | 900 x 420 | "Scentia, perfumes con contexto" |
| Pie de página | `footerMark` | `public/brand/mark.svg` (emblema cuadrado) | 512 x 512 (se muestra a 2,5 rem) | vacío (decorativa) |
| Ingresar, crear cuenta y elegir contraseña | `authMark` | `public/brand/mark.svg` | 512 x 512 (se muestra a 3,5 rem) | vacío |
| 404 y pantalla de error | `emptyState` | `public/brand/logo-stacked.svg` | 900 x 420 (se muestra a 15 rem) | vacío |
| Imagen al compartir en redes (Open Graph y Twitter) | `ogImage` | `public/brand/og.png` | 1800 x 840 | "Scentia, perfumes con contexto" |
| Ícono de la app / pestaña del navegador | (convención de Next) | `src/app/icon.svg` | 512 x 512 | no aplica |

Los originales están en `assets/` (no se modifican). Los de `public/brand/` son copias a las que solo se les quitó el bloque
`<metadata>` (manifiesto C2PA en base64, ~8 kB por archivo) y, en el logo horizontal, el rectángulo de fondo opaco, para que el logo
se vea bien sobre el encabezado translúcido. `og.png` es `scentia-logo.png` tal cual.

## Cómo reemplazar un archivo

1. Copiar el nuevo archivo a `public/brand/` (mismo nombre, o nombre nuevo en minúsculas y sin espacios).
2. Si cambió la proporción, actualizar `width` y `height` del slot en `src/lib/brand-assets.ts` (reservan el espacio y evitan el salto
   de diseño) y, si hace falta, el tamaño visible en `globals.css` (`.site-logo`, `.home-hero-art`, `.auth-mark`, `.empty-art`).
3. Si cambió el contenido, revisar el texto alternativo (`alt`). Una imagen decorativa lleva `alt: ''`.
4. Para apagar un lugar sin borrar el archivo: `available: false`.

## Formatos recomendados

- Logos y emblema: SVG con texto convertido a trazados. Quitar metadatos pesados.
- Fotos de ambiente (si se suman): JPG o WebP, 1600 x 900 px para la portada, 1200 x 630 px para compartir; menos de 300 kB.
  Para usar una foto como portada, apuntar el slot `hero` a la foto y poner `available: true`.
- Ícono PNG: 512 x 512 (y 180 x 180 para iPhone, `src/app/apple-icon.png`). Next agrega las etiquetas solo con poner el archivo.

## Pendiente y límites

- `src/app/favicon.ico` sigue siendo el de Next (no se pudo generar un `.ico` de la marca sin herramientas). Conviene reemplazarlo por uno
  con el emblema (o borrarlo para que los navegadores usen `icon.svg`). No se hizo sin tu confirmación.
- `og.png` mide 1800 x 840 (2,14:1); Facebook y X recortan un poco los costados respecto del 1,91:1 ideal. El logo tiene margen de sobra.
- No se vio ninguna pantalla en un navegador (en este entorno no arranca): el tamaño visible de cada logo está razonado sobre el CSS.
