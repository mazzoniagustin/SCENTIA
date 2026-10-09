"use client";

import { startTransition, useActionState, useState } from "react";

import { saveCollectionEntryAction } from "@/app/actions/collection";
import { IDLE_STATE } from "@/lib/collection/form";

type InitialData = { status: string; rating?: number | null; personalNotes?: string | null };

// Guardar un perfume en la colección. Muestra el resultado (guardado o error) y el estado de "Guardando…".
// El envío se hace en `onSubmit` (no con `action={...}`): React 19 reinicia el formulario tras una acción de formulario y los
// <select> controlados quedaban en blanco aunque el estado conservara el valor. Así lo escrito se mantiene al guardar o al fallar.
export function CollectionForm({ perfumeId, initialData }: { perfumeId: string; initialData?: InitialData }) {
  const [state, formAction, pending] = useActionState(saveCollectionEntryAction, IDLE_STATE);
  const [status, setStatus] = useState(initialData?.status ?? "");
  const [rating, setRating] = useState(initialData?.rating ? String(initialData.rating) : "");
  const [notes, setNotes] = useState(initialData?.personalNotes ?? "");

  return (
    <form
      className="collection-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="perfumeId" value={perfumeId} />
      <label>
        <span className="collection-label">Estado</span>
        <select name="status" aria-label="Estado en tu colección" value={status} onChange={(e) => setStatus(e.target.value)} required>
          <option value="" disabled>
            Elegí un estado
          </option>
          <option value="OWNED">Lo tengo</option>
          <option value="SAMPLED">Probé una muestra</option>
          <option value="WISHLIST">Lo quiero</option>
          <option value="DISLIKED">No me gustó</option>
        </select>
      </label>
      <label>
        <span className="collection-label">Puntuación (opcional)</span>
        <select name="rating" aria-label="Puntuación de 1 a 5" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Sin puntuar</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} de 5
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="collection-label">Notas personales (opcional)</span>
        <textarea name="personalNotes" aria-label="Notas personales" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cómo te queda, cuándo lo usás…" />
      </label>
      <button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <p
        className={state.status === "error" ? "form-message form-message-error" : "form-message form-message-success"}
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
