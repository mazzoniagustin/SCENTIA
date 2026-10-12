// Validación de procedencia antes de publicar (RF-06, ver docs/imagenes.md). Lógica pura: sin Prisma ni server-only.
import { isAllowedImageUrl, isAllowedSourcePageUrl } from '../images.ts'

export type ProvenanceInput = {
  source: string | null
  imageUrl: string | null
  imageSource: string | null
  imageSourceUrl: string | null
}

const blank = (v: string | null | undefined) => v == null || v.trim() === ''

/** Motivos por los que un perfume no se puede publicar; lista vacía si la procedencia está completa.
 *  Una imagen retirada a propósito (imageUrl NULL e imageSource 'removed') no exige datos de imagen. */
export function provenanceProblems(p: ProvenanceInput): string[] {
  const problems: string[] = []
  if (blank(p.source)) problems.push('falta source')
  if (!blank(p.imageUrl)) {
    if (!isAllowedImageUrl(p.imageUrl)) problems.push('imageUrl con host o formato no permitido')
    if (blank(p.imageSource)) problems.push('falta imageSource')
    if (blank(p.imageSourceUrl)) problems.push('falta imageSourceUrl')
    else if (!isAllowedSourcePageUrl(p.imageSourceUrl)) problems.push('imageSourceUrl con host o formato no permitido')
  }
  return problems
}
