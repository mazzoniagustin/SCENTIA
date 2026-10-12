"use client";

import { useFormStatus } from "react-dom";

// Botón de envío de los formularios de acceso. Mientras la acción responde usa aria-disabled (sigue
// enfocable y anunciado) y bloquea el clic para evitar el doble envío. Sin JavaScript es un botón normal.
export function AuthSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      {pending ? (
        <>
          <span className="wear-spinner" aria-hidden="true" />
          <span role="status">Enviando…</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
