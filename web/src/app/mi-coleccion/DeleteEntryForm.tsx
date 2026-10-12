"use client";

import { useActionState } from "react";

import { deleteCollectionEntryAction } from "@/app/actions/collection";
import { IDLE_STATE } from "@/lib/collection/form";

// Eliminar un perfume de la colección. Usa `action` (funciona sin JavaScript) y muestra "Eliminando…" y el error junto a la tarjeta.
// Se usa aria-disabled y no `disabled` para que el botón conserve el foco mientras se procesa; el envío doble se ignora.
export function DeleteEntryForm({ perfumeId }: { perfumeId: string }) {
  const [state, formAction, pending] = useActionState(deleteCollectionEntryAction, IDLE_STATE);

  return (
    <form action={formAction} onSubmit={(event) => pending && event.preventDefault()}>
      <input type="hidden" name="perfumeId" value={perfumeId} />
      <button type="submit" className="button-danger" aria-disabled={pending}>
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      <p className="form-message form-message-error" role="alert">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
