// Barra de progreso indeterminada con el mismo aspecto que la del quiz (pista fina y relleno dorado). Se usa mientras
// carga un perfume o una lista; sin movimiento (`prefers-reduced-motion`) queda como una barra parcial fija.
export function LoadBar({ label }: { label: string }) {
  return (
    <div className="load-bar" role="progressbar" aria-label={label} aria-busy="true">
      <span />
    </div>
  );
}

// Marcador de una sección que carga: barra + texto + forma aproximada del contenido que va a aparecer.
export function LoadingPanel({ label, minHeight = "12rem" }: { label: string; minHeight?: string }) {
  return (
    <div className="loading-panel" style={{ minHeight }}>
      <LoadBar label={label} />
      <p className="loading-panel-label">{label}</p>
    </div>
  );
}
