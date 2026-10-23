"use client";

import { useRef, useState } from "react";

import { perfumeCountLabel } from "@/lib/share/count-label";
import type { ShareScope } from "@/lib/share/view";
import { ShareScopePanel } from "./ShareScopePanel";
import type { ShareInfo } from "./ShareScopePanel";

type Props = {
  shares: ShareInfo[];
  ownedCount: number;
  wishlistCount: number;
  collectionEmpty: boolean;
};

const OPTIONS: { scope: ShareScope; label: string }[] = [
  { scope: "OWNED", label: "Lo que tengo" },
  { scope: "WISHLIST", label: "Lo que quiero" },
];

// Botón «Compartir» del encabezado de Mi colección y su diálogo: elegir la lista, generar el link, copiarlo o dejar de compartir.
// <dialog> con showModal(): el foco queda atrapado, Escape cierra y el fondo es inerte sin código propio.
export function ShareDialog({ shares, ownedCount, wishlistCount, collectionEmpty }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Si el gesto empezó dentro del diálogo (p. ej. seleccionar el link) y terminó en el fondo, no es un clic en el fondo.
  const pressedOnBackdrop = useRef(false);
  const shareOf = (scope: ShareScope) => shares.find((s) => s.scope === scope);
  const counts: Record<ShareScope, number> = { OWNED: ownedCount, WISHLIST: wishlistCount };

  // Con la colección vacía solo se ofrecen las listas con link activo (para poder revocarlo).
  const available = OPTIONS.filter((o) => !collectionEmpty || shareOf(o.scope));
  const [chosen, setChosen] = useState<ShareScope>("OWNED");
  const scope = available.some((o) => o.scope === chosen) ? chosen : available[0]?.scope;

  if (available.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button-ghost"
        onClick={() => dialogRef.current?.showModal()}
      >
        Compartir
      </button>
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="share-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        // El clic en el fondo cae sobre el propio <dialog> (el contenido va en un contenedor interno).
        onPointerDown={(event) => {
          pressedOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (pressedOnBackdrop.current && event.target === event.currentTarget) event.currentTarget.close();
          pressedOnBackdrop.current = false;
        }}
      >
        <div className="share-dialog-body">
          <div className="share-dialog-head">
            <h2 id="share-dialog-title">Compartir mi colección</h2>
            <button type="button" className="share-close" aria-label="Cerrar" onClick={() => dialogRef.current?.close()}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <fieldset className="share-scopes">
            <legend>Qué querés compartir</legend>
            {available.map((option) => (
              <label key={option.scope} className="share-scope-option">
                <input
                  type="radio"
                  name="share-scope"
                  value={option.scope}
                  checked={scope === option.scope}
                  onChange={() => setChosen(option.scope)}
                />
                <span className="share-scope-text">
                  <span>{option.label}</span>
                  <span className="share-scope-count">{perfumeCountLabel(counts[option.scope])}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Los dos paneles siempre montados: cada lista conserva su propio estado aunque se cambie de opción. */}
          {OPTIONS.map((option) => (
            <ShareScopePanel key={option.scope} scope={option.scope} share={shareOf(option.scope)} active={scope === option.scope} />
          ))}

          <p className="share-notice">
            El link muestra tu colección actual: si cambiás el estado de un perfume, pasa de una lista a otra.
          </p>
        </div>
      </dialog>
    </>
  );
}
