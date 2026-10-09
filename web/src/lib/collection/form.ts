// Interpreta el formulario de la colección (campos HTML) y define el estado que se devuelve a la pantalla. Lógica pura.

export type CollectionFormState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export const IDLE_STATE: CollectionFormState = { status: 'idle' }

/** Campos del formulario como entrada cruda: la validación (tipos, rangos, estados) la hace `validateCollectionEntry`. */
export function collectionInputFromFormData(formData: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = formData.get(name)
    return typeof value === 'string' ? value : undefined
  }
  const ratingText = text('rating')?.trim()
  const notes = text('personalNotes')
  return {
    perfumeId: text('perfumeId'),
    status: text('status'),
    // Vacío = sin puntuar; un valor no numérico llega como NaN y la validación lo rechaza con un mensaje claro.
    rating: ratingText ? Number(ratingText) : undefined,
    personalNotes: notes && notes.trim() ? notes : undefined,
  }
}
