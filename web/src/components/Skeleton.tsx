// Marcadores de posición con brillo mientras carga el contenido (streaming). Decorativos: se anuncian como "cargando".

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SectionSkeleton({ title, lines = 3 }: { title: string; lines?: number }) {
  return (
    <section className="ficha-section" aria-busy="true" aria-label={`Cargando ${title}`}>
      <h2>{title}</h2>
      <div className="skeleton-stack" role="status">
        <span className="sr-only">Cargando {title}…</span>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="skeleton-line" style={{ width: `${92 - i * 14}%` }} />
        ))}
      </div>
    </section>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="catalog-grid" role="status" aria-label="Cargando perfumes">
      <span className="sr-only">Cargando perfumes…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="perfume-card skeleton-card" aria-hidden="true">
          <Skeleton className="skeleton-media" />
          <div className="perfume-card-body">
            <Skeleton className="skeleton-line" style={{ width: "40%" }} />
            <Skeleton className="skeleton-line" style={{ width: "80%", height: "1.1rem" }} />
            <Skeleton className="skeleton-line" style={{ width: "55%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
