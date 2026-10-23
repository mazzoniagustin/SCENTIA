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

const TITLES: Record<ShareScope, string> = { OWNED: "Lo que tengo", WISHLIST: "Lo que quiero" };

// Panel de una lista compartible (Lo tengo / Lo quiero): crear o regenerar el link, copiarlo y dejar de compartir.
// Los formularios usan `action` (funcionan sin JavaScript). aria-disabled y no `disabled` para conservar el foco mientras se procesa.
export function ShareScopePanel({ scope, share, active }: { scope: ShareScope; share?: ShareInfo; active: boolean }) {
  const [createState, createAction, creating] = useActionState(createShareAction, IDLE_SHARE_STATE);
  const [revokeState, revokeAction, revoking] = useActionState(revokeShareAction, IDLE_SHARE_STATE);
  const [copyNote, setCopyNote] = useState("");
  // Token cuyo link se revocó: se oculta aunque `createState` lo conserve. Un create posterior trae otro token y se muestra.
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const [seenRevoke, setSeenRevoke] = useState(revokeState);
  if (revokeState !== seenRevoke) {
    setSeenRevoke(revokeState);
    if (revokeState.status === "success") setDismissedToken(createState.token ?? null);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  const shownToken = createState.token && createState.token !== dismissedToken ? createState.token : null;
  // El aviso de «copiado» pertenece al link que se mostraba: si cambia el link, se borra.
  const [seenToken, setSeenToken] = useState(shownToken);
  if (shownToken !== seenToken) {
    setSeenToken(shownToken);
    setCopyNote("");
  }

  const origin = useClientValue(() => window.location.origin, "");
  const canShare = useClientValue(() => typeof navigator.share === "function", false);
  const url = shownToken && origin ? `${origin}/c/${createState.token}` : "";

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

  const inputId = `share-url-${scope}`;
  const alertMessage = createState.status === "error" ? createState.message : revokeState.status === "error" ? revokeState.message : "";
  // Un solo aviso en vivo por panel: copiado, link creado (solo con el link a la vista) o link revocado (solo sin link a la vista).
  const statusMessage = url ? copyNote || "Link creado." : revokeState.status === "success" ? revokeState.message : "";

  return (
    <div className="share-scope" hidden={!active}>
      {share && !url ? (
        <p className="share-active">
          Link activo desde {dateFormat.format(new Date(share.createdAt))}.
          {scope === "OWNED" ? (share.showRatings ? " Muestra tus puntuaciones." : " No muestra tus puntuaciones.") : ""}
        </p>
      ) : null}

      <form className="share-form" action={createAction} onSubmit={(event) => creating && event.preventDefault()}>
        <input type="hidden" name="scope" value={scope} />
        {scope === "OWNED" ? (
          <label className="share-check">
            <input type="checkbox" name="showRatings" defaultChecked={share?.showRatings ?? false} />
            Mostrar mis puntuaciones
          </label>
        ) : null}
        <div className="share-actions">
          <button type="submit" className={share ? "button button-ghost" : "button"} aria-disabled={creating}>
            {creating ? "Generando…" : share ? "Generar uno nuevo" : "Generar link"}
          </button>
          {share ? <span className="share-note">El link anterior deja de funcionar</span> : null}
        </div>
      </form>

      {url ? (
        <div className="share-link">
          <label htmlFor={inputId}>Tu link</label>
          <div className="share-link-row">
            <input
              id={inputId}
              name={inputId}
              ref={inputRef}
              type="text"
              readOnly
              autoComplete="off"
              spellCheck={false}
              value={url}
              aria-describedby={`${inputId}-help`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="button" onClick={copy}>
              Copiar
            </button>
          </div>
          <p id={`${inputId}-help`} className="share-note">
            Copialo ahora: no lo vas a poder ver de nuevo.
          </p>
          {canShare ? (
            <button type="button" className="button button-ghost share-native" onClick={nativeShare}>
              Compartir
            </button>
          ) : null}
        </div>
      ) : null}

      {active ? (
        <p className="form-message" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
      <p className="form-message form-message-error" role="alert">
        {active ? alertMessage : ""}
      </p>

      {share ? (
        <details className="share-revoke">
          <summary>Dejar de compartir</summary>
          <form action={revokeAction} onSubmit={(event) => revoking && event.preventDefault()}>
            <p>El link deja de funcionar para cualquiera que lo tenga.</p>
            <input type="hidden" name="scope" value={scope} />
            <button type="submit" className="button-danger" aria-disabled={revoking}>
              {revoking ? "Quitando…" : "Sí, dejar de compartir"}
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
