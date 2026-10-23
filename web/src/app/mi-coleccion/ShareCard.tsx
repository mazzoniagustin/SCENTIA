"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";

import { createShareAction, revokeShareAction } from "@/app/actions/share";
import { IDLE_SHARE_STATE } from "@/lib/share/form";
import type { ShareScope } from "@/lib/share/view";

export type ShareInfo = { scope: ShareScope; showRatings: boolean; createdAt: string };

const noopSubscribe = () => () => {};
// Valor del navegador sin desfase de hidratación: en el servidor es "" y en el cliente el valor real.
function useClientValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => server);
}

// Fecha fija (zona horaria explícita) para que servidor y cliente rendericen lo mismo.
const dateFormat = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

const TITLES: Record<ShareScope, string> = { OWNED: "Lo tengo", WISHLIST: "Lo quiero" };

// Una lista compartible (Lo tengo / Lo quiero): crear o regenerar el link, copiarlo y dejar de compartir.
// Los formularios usan `action` (funcionan sin JavaScript). aria-disabled y no `disabled` para conservar el foco mientras se procesa.
export function ShareCard({ scope, share }: { scope: ShareScope; share?: ShareInfo }) {
  const [createState, createAction, creating] = useActionState(createShareAction, IDLE_SHARE_STATE);
  const [revokeState, revokeAction, revoking] = useActionState(revokeShareAction, IDLE_SHARE_STATE);
  const [copyNote, setCopyNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const origin = useClientValue(() => window.location.origin, "");
  const canShare = useClientValue(() => typeof navigator.share === "function", false);
  const titleId = `share-title-${scope}`;
  const url = createState.token && origin ? `${origin}/c/${createState.token}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyNote("Copiado");
    } catch {
      inputRef.current?.select();
      setCopyNote("No pudimos copiar solo: el link quedó seleccionado, copialo a mano.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: `Mi colección: ${TITLES[scope]}`, url });
    } catch {
      // La persona canceló el panel de compartir: no es un error.
    }
  }

  return (
    <section className="share-card" aria-labelledby={titleId}>
      <h3 id={titleId}>{TITLES[scope]}</h3>

      {share && !url ? (
        <p className="share-active">
          Link activo desde {dateFormat.format(new Date(share.createdAt))}.
          {scope === "OWNED" ? (share.showRatings ? " Muestra tus puntuaciones." : " No muestra tus puntuaciones.") : ""}
        </p>
      ) : null}

      <form action={createAction} onSubmit={(event) => creating && event.preventDefault()}>
        <input type="hidden" name="scope" value={scope} />
        {scope === "OWNED" ? (
          <label className="share-check">
            <input type="checkbox" name="showRatings" defaultChecked={share?.showRatings ?? false} />
            Mostrar mis puntuaciones
          </label>
        ) : null}
        {share ? <p className="share-note">Si generás uno nuevo, el link anterior deja de funcionar.</p> : null}
        <button type="submit" className="button" aria-disabled={creating}>
          {creating ? "Generando…" : share ? "Generar uno nuevo" : "Generar link"}
        </button>
        <p
          className={`form-message ${createState.status === "error" ? "form-message-error" : ""}`}
          role={createState.status === "error" ? "alert" : "status"}
        >
          {createState.message}
        </p>
      </form>

      {url ? (
        <div className="share-link">
          <label htmlFor={`share-url-${scope}`}>Tu link</label>
          <input id={`share-url-${scope}`} ref={inputRef} type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="share-link-actions">
            <button type="button" className="button" onClick={copy}>
              Copiar
            </button>
            {canShare ? (
              <button type="button" className="button" onClick={nativeShare}>
                Compartir
              </button>
            ) : null}
          </div>
          <p className="form-message" role="status" aria-live="polite">
            {copyNote}
          </p>
        </div>
      ) : null}

      {share ? (
        <details className="private-delete">
          <summary>Dejar de compartir</summary>
          <form action={revokeAction} onSubmit={(event) => revoking && event.preventDefault()}>
            <p>El link deja de funcionar para cualquiera que lo tenga.</p>
            <input type="hidden" name="scope" value={scope} />
            <button type="submit" className="button-danger" aria-disabled={revoking}>
              {revoking ? "Quitando…" : "Sí, dejar de compartir"}
            </button>
            <p className="form-message form-message-error" role="alert">
              {revokeState.status === "error" ? revokeState.message : ""}
            </p>
          </form>
        </details>
      ) : null}
    </section>
  );
}
