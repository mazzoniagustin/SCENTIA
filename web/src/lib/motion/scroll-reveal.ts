// Estado de entrada de los elementos que ya llegan renderizados desde el servidor (anillo de afinidad, barras de la ficha).
// Sin React ni DOM, para poder probarlo con node:test.
//
//   initial → estado del servidor y de quien no tiene JavaScript: todo visible y con la entrada por tiempo (CSS) que corre al cargar.
//   static  → la persona pidió menos movimiento o no hay IntersectionObserver: todo visible y quieto.
//   pending → está fuera de la ventana: el CSS lo deja listo para entrar, sin animar todavía.
//   shown   → ya entró en pantalla: corre la animación.

export type ScrollRevealState = 'initial' | 'static' | 'pending' | 'shown'

/**
 * Estado con el que arranca el elemento una vez hidratado. Si ya se ve en pantalla se deja `initial` (la entrada por tiempo
 * está corriendo y se ve); si está fuera, `pending` hasta que aparezca. `rect` es `getBoundingClientRect()` del elemento.
 */
export function decideScrollReveal(input: {
  canAnimate: boolean
  rect: { top: number; bottom: number }
  viewportHeight: number
}): Exclude<ScrollRevealState, 'shown'> {
  if (!input.canAnimate) return 'static'
  const visibleNow = input.rect.top < input.viewportHeight && input.rect.bottom > 0
  return visibleNow ? 'initial' : 'pending'
}
