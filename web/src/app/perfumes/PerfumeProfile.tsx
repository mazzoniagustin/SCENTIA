// Acordes con barra de intensidad y pirámide de notas (salida / corazón / fondo), como en Fragrantica.
// Se usa en la ficha y en el perfume del día.

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const PHASES = [
  { type: "top", label: "Salida" },
  { type: "heart", label: "Corazón" },
  { type: "base", label: "Fondo" },
] as const;

export function AccordBars({ accords }: { accords: Array<{ name: string; intensity: number }> }) {
  if (accords.length === 0) return <p>Sin dato</p>;
  return (
    <ul className="ficha-accords">
      {accords.map(({ name, intensity }) => (
        <li key={name}>
          <span>{capitalize(name)}</span>
          <span className="ficha-bar" role="img" aria-label={`${intensity} de 100`}>
            <span style={{ width: `${intensity}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NotePyramid({ notes }: { notes: Array<{ noteType: string; name: string }> }) {
  if (notes.length === 0) return <p>Sin dato</p>;
  const hasTiers = notes.some((n) => n.noteType !== "flat");
  const hasFlat = notes.some((n) => n.noteType === "flat");
  // Los perfumes sin pirámide (solo lista de notas) muestran un único grupo; los demás, los tres pisos.
  const phases = [...(hasTiers ? PHASES : []), ...(hasFlat ? [{ type: "flat", label: "Notas" }] : [])];
  return (
    <div className="ficha-phases">
      {phases.map(({ type, label }) => {
        const names = notes.filter((n) => n.noteType === type).map((n) => n.name);
        return (
          <div key={type}>
            <h3>{label}</h3>
            {names.length === 0 ? (
              <p>Sin dato</p>
            ) : (
              <ul className="perfume-badges">
                {names.map((name) => (
                  <li key={name} lang="en">
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
