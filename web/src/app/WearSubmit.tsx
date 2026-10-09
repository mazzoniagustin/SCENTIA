"use client";

import { useFormStatus } from "react-dom";

// Botón de la racha con estado de carga: se deshabilita y dice "Guardando…" mientras la acción del servidor responde.
export function WearSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="wear-submit" disabled={pending} aria-disabled={pending}>
      {pending ? (
        <>
          <span className="wear-spinner" aria-hidden="true" />
          Guardando…
        </>
      ) : (
        label
      )}
    </button>
  );
}
