"use client";

import { ShareCard, type ShareInfo } from "./ShareCard";

// Bloque «Compartir» de Mi colección: un link público de solo lectura por lista.
export function SharePanel({ shares, onlyActive = false }: { shares: ShareInfo[]; onlyActive?: boolean }) {
  // Con la colección vacía solo se muestran las listas con link activo (para poder revocarlo).
  const owned = shares.find((s) => s.scope === "OWNED");
  const wishlist = shares.find((s) => s.scope === "WISHLIST");
  return (
    <section className="share-panel" aria-labelledby="share-panel-title">
      <h2 id="share-panel-title">Compartir</h2>
      <p className="share-notice">El link muestra tu colección actual: si cambiás el estado de un perfume, pasa de una lista a otra.</p>
      <div className="share-cards">
        {!onlyActive || owned ? <ShareCard scope="OWNED" share={owned} /> : null}
        {!onlyActive || wishlist ? <ShareCard scope="WISHLIST" share={wishlist} /> : null}
      </div>
    </section>
  );
}
