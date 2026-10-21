"use client";

import { useActionState } from "react";

import { deleteCollectionEntryAction } from "@/app/actions/collection";
import { IDLE_STATE } from "@/lib/collection/form";

// Eliminar un perfume de la colección. Usa `action` (funciona sin JavaScript) y muestra "Eliminando…" y el error junto a la tarjeta.
// La confirmación es un <details> (mismo patrón y estilos que DeletePrivatePerfumeForm): el primer clic solo la abre.
// Se usa aria-disabled y no `disabled` para que el botón conserve el foco mientras se procesa; el envío doble se ignora.
export function DeleteEntryForm({ perfumeId }: { perfumeId: string }) {
  const [state, formAction, pending] = useActionState(deleteCollectionEntryAction, IDLE_STATE);

  return (
    <details className="private-delete">
      <summary>Eliminar</summary>
      <form action={formAction} onSubmit={(event) => pending && event.preventDefault()}>
        <p>Se quita de tu colección junto con tu puntuación y tus notas. No se puede deshacer.</p>
        <input type="hidden" name="perfumeId" value={perfumeId} />
        <button type="submit" className="button-danger" aria-disabled={pending}>
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <p className="form-message form-message-error" role="alert">
          {state.status === "error" ? state.message : ""}
        </p>
      </form>
    </details>
  );
}
