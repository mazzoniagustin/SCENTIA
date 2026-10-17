// Identidad visual: los lugares de la página donde van las fotos y el logo de la marca (archivos propios en `public/brand/`).
// Cada lugar ("slot") está listo pero apagado (`available: false`) hasta que el archivo exista: así no hay imágenes rotas ni
// saltos de diseño. Para encenderlo: copiar el archivo a `public/brand/`, ajustar `width`/`height` y poner `available: true`.
// Las imágenes salen del mismo origen (`img-src 'self'` de la CSP). Ver docs/identidad-visual.md. Lógica pura (sin DOM).

export type BrandSlot = 'logo' | 'footerMark' | 'hero' | 'authMark' | 'emptyState' | 'ogImage'

export type BrandAsset = {
  /** Ruta pública del archivo (siempre bajo /brand/). */
  src: string
  /** Tamaño real del archivo en píxeles: reserva el espacio y evita saltos de diseño. */
  width: number
  height: number
  /** Texto alternativo. Vacío = decorativa (la imagen no aporta información que no esté en el texto). */
  alt: string
  /** ¿Ya está el archivo en `public/brand/`? */
  available: boolean
}

export const BRAND_ASSETS: Record<BrandSlot, BrandAsset> = {
  // Logo horizontal (emblema + palabra), sin fondo: encabezado.
  logo: { src: '/brand/logo.svg', width: 235, height: 75, alt: 'Scentia', available: true },
  // Emblema cuadrado (fondo oscuro de la marca): pie de página y encabezado de las pantallas de cuenta. Decorativo.
  footerMark: { src: '/brand/mark.svg', width: 512, height: 512, alt: '', available: true },
  authMark: { src: '/brand/mark.svg', width: 512, height: 512, alt: '', available: true },
  // Logo vertical con la frase "Perfumes con contexto", sin fondo: portada y pantallas 404 / de error.
  hero: { src: '/brand/logo-stacked.svg', width: 900, height: 420, alt: 'Scentia, perfumes con contexto', available: true },
  emptyState: { src: '/brand/logo-stacked.svg', width: 900, height: 420, alt: '', available: true },
  // Imagen para compartir en redes (1800 x 840 px).
  ogImage: { src: '/brand/og.png', width: 1800, height: 840, alt: 'Scentia, perfumes con contexto', available: true },
}

/** Ruta válida: dentro de /brand/, sin subir de carpeta, sin esquema ni host. */
export function isBrandSrc(src: string): boolean {
  return /^\/brand\/[a-z0-9][a-z0-9._-]*$/i.test(src) && !src.includes('..')
}

/** El archivo del slot, o null si todavía no se cargó (o la ruta no es válida): quien lo use no dibuja nada. */
export function getBrandAsset(slot: BrandSlot, assets: Record<BrandSlot, BrandAsset> = BRAND_ASSETS): BrandAsset | null {
  const asset = assets[slot]
  if (!asset?.available || !isBrandSrc(asset.src)) return null
  return asset
}

/** Los SVG no pasan por el optimizador de imágenes (ya son vectoriales). */
export function isSvg(src: string): boolean {
  return src.toLowerCase().endsWith('.svg')
}
