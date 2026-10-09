"use client";

import Link from "next/link";
import { useEffect } from "react";

// Pantalla de error propia (en español, dentro del layout): antes un fallo mostraba la pantalla por defecto de Next.
// `retry` vuelve a pedir y a dibujar el contenido de la página (API estable desde Next 16.3).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // En producción el mensaje viene redactado; el `digest` permite ubicar el error en los registros del servidor.
    console.error("Error de página", error.digest ?? "");
  }, [error]);

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Algo salió mal</p>
        <h1>No pudimos cargar esta página</h1>
        <p className="lead">Fue un problema nuestro, no tuyo. Probá de nuevo; si sigue fallando, volvé al inicio.</p>
      </header>
      <div className="landing-actions">
        <button type="button" className="button" onClick={() => retry()}>
          Reintentar
        </button>
        <Link className="button button-ghost" href="/">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
