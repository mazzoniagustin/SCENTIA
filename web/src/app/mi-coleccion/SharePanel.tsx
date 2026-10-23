"use client";

import { ShareCard, type ShareInfo } from "./ShareCard";

// Bloque «Compartir» de Mi colección: un link público de solo lectura por lista.
export function SharePanel({ shares }: { shares: ShareInfo[] }) {
  return (
    <section className="share-panel" aria-labelledby="share-panel-title">
      <h2 id="share-panel-title">Compartir</h2>
      <p className="share-notice">El link muestra tu colección actual: si cambiás el estado de un perfume, pasa de una lista a otra.</p>
      <div className="share-cards">
        <ShareCard scope="OWNED" share={shares.find((s) => s.scope === "OWNED")} />
        <ShareCard scope="WISHLIST" share={shares.find((s) => s.scope === "WISHLIST")} />
      </div>
    </section>
  );
}
