// Anillo de afinidad: se dibuja al aparecer (animación CSS). Decorativo: el porcentaje también está en el texto de la tarjeta.
export function AffinityRing({ percent, index = 0 }: { percent: number; index?: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="affinity-ring" aria-hidden="true" style={{ "--p": value, "--delay": `${index * 60 + 200}ms` } as React.CSSProperties}>
      <svg viewBox="0 0 36 36">
        <circle className="affinity-track" cx="18" cy="18" r="15.9155" pathLength="100" />
        <circle className="affinity-fill" cx="18" cy="18" r="15.9155" pathLength="100" />
      </svg>
      <span>{value}%</span>
    </div>
  );
}
