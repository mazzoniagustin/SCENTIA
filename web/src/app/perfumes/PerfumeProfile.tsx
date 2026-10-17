// Acordes con barra de intensidad y pirámide de notas (salida / corazón / fondo), como en Fragrantica.
// Se usa en la ficha y en el perfume del día.

import { ScrollReveal } from "@/components/ScrollReveal";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const PHASES = [
  { type: "top", label: "Salida" },
  { type: "heart", label: "Corazón" },
  { type: "base", label: "Fondo" },
] as const;

export function AccordBars({ accords }: { accords: Array<{ name: string; intensity: number }> }) {
  // Sin datos no se muestra nada: quien lo use decide si oculta también su título.
  if (accords.length === 0) return null;
  return (
    <ScrollReveal as="ul" className="ficha-accords">
      {accords.map(({ name, intensity }) => (
        <li key={name}>
          <span>{capitalize(name)}</span>
          <span className="ficha-bar" role="img" aria-label={`${intensity} de 100`}>
            <span style={{ width: `${intensity}%` }} />
          </span>
        </li>
      ))}
    </ScrollReveal>
  );
}

export function NotePyramid({ notes }: { notes: Array<{ noteType: string; name: string }> }) {
  if (notes.length === 0) return null;
  const hasTiers = notes.some((n) => n.noteType !== "flat");
  const hasFlat = notes.some((n) => n.noteType === "flat");
  // Los perfumes sin pirámide (solo lista de notas) muestran un único grupo, sin rótulo (el título de la sección ya dice "Notas");
  // si conviven con pisos, las notas sueltas llevan "Otras notas". Los pisos sin notas se omiten.
  const phases: ReadonlyArray<{ type: string; label: string | null }> = [
    ...(hasTiers ? PHASES : []),
    ...(hasFlat ? [{ type: "flat", label: hasTiers ? "Otras notas" : null }] : []),
  ];
  return (
    <div className="ficha-phases">
      {phases.map(({ type, label }) => {
        const names = notes.filter((n) => n.noteType === type).map((n) => n.name);
        if (names.length === 0) return null;
        return (
          <div key={type}>
            {label && <h3>{label}</h3>}
            <ul className="perfume-badges">
              {names.map((name) => (
                <li key={name} lang="en">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
