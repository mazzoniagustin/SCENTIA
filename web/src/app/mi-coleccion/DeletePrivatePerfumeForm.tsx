"use client";

import { useActionState } from "react";

import { deletePrivatePerfumeAction } from "@/app/actions/private-perfumes";
import { IDLE_STATE } from "@/lib/collection/form";

// Eliminar un perfume propio: a diferencia de quitar uno del catálogo, borra el perfume entero, su foto y los días que se registró.
// La confirmación es un <details> (funciona sin JavaScript). Se usa aria-disabled para que el botón conserve el foco al procesar.
export function DeletePrivatePerfumeForm({ perfumeId }: { perfumeId: string }) {
  const [state, formAction, pending] = useActionState(deletePrivatePerfumeAction, IDLE_STATE);

  return (
    <details className="private-delete">
      <summary>Eliminar perfume</summary>
      <form action={formAction} onSubmit={(event) => pending && event.preventDefault()}>
        <p>Se borran el perfume, su foto y los días en que lo registraste. No se puede deshacer.</p>
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
