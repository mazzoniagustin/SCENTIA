import Link from "next/link";
import { IdentityCard } from "./IdentityCard";
import { NO_DATA, Perfume } from "../types";

import {
  axisPoint,
  buildRadarAxes,
  polygonPoints,
  radarPoints,
  radarValues,
  seriesColor,
} from "@/lib/compare/radar";
import { logServerError } from "@/lib/log";
import { listPerfumes } from "@/lib/perfumes/list";

// Radio y centro del radar dentro del viewBox; el anillo exterior lleva las
// etiquetas de eje (r = R + 22) — todo derivado de la misma geometría.
const RADAR_SIZE = 480;
const RADAR_C = RADAR_SIZE / 2;
const RADAR_R = 180;
const AXIS_LABEL_R = RADAR_R + 26;

// Rings de referencia: exterior (100) y medio (50), solid hairlines.
const RING_RADII = [RADAR_R, RADAR_R / 2];

const NOTE_ORDER = ["top", "heart", "base"] as const;

async function fetchCompare(ids: string): Promise<{
  perfumes: Perfume[];
  missing: string[];
  error?: string;
}> {
  try {
    const result = await listPerfumes(new URLSearchParams({ ids }));
    if (!result.ok) return { perfumes: [], missing: [], error: result.error };
    const body = result.body as { data: Perfume[]; missing?: string[] };
    return { perfumes: body.data, missing: body.missing ?? [] };
  } catch (error) {
    logServerError("perfumes/compare", error);
    return { perfumes: [], missing: [], error: "No se pudo cargar la comparación." };
  }
}

function RadarChart({ perfumes }: { perfumes: Perfume[] }) {
  const { axes, truncated } = buildRadarAxes(perfumes);
  const total = axes.length;

  // Grilla: anillos de referencia + radios por eje, hairlines del mismo tono
  // que la superficie (var(--border) en la tarea 5).
  const rings = RING_RADII.map(
    (r) => polygonPoints(axes.map((_, i) => axisPoint(i, total, r, RADAR_C, RADAR_C))),
  );
  const spokes = axes.map((_, i) => axisPoint(i, total, RADAR_R, RADAR_C, RADAR_C));
  const labels = axes.map((name, i) => ({
    name,
    at: axisPoint(i, total, AXIS_LABEL_R, RADAR_C, RADAR_C),
  }));

  const series = perfumes.map((perfume, index) => {
    const values = radarValues(perfume, axes);
    return {
      perfume,
      color: seriesColor(index),
      points: polygonPoints(radarPoints(values, total, RADAR_R, RADAR_C, RADAR_C)),
      // <title> nativo del SVG: hover de mouse y lectoras de pantalla.
      title: `${perfume.brand} ${perfume.name}: ${axes
        .map((axis, i) => `${axis} ${values[i]}`)
        .join(", ")}`,
    };
  });

  // El vértice al centro de un perfume que no tiene el acorde es ausencia
  // (spec RF-03), no intensidad 0 — la nota lo explicita solo cuando ocurre.
  const absentAxes = axes.filter((axis) =>
    perfumes.some((p) => !(p.accords ?? []).some((a) => a.accord.name === axis)),
  );

  return (
    <div className="compare-radar">
      <svg
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        role="img"
        aria-labelledby="compare-radar-title compare-radar-desc"
      >
        <title id="compare-radar-title">
          {`Intensidad de acordes de ${perfumes.map((p) => p.name).join(", ")}, escala 0 a 100`}
        </title>
        <desc id="compare-radar-desc">
          Cada polígono es un perfume; cada eje un acorde compartido. La tabla
          de acordes debajo reproduce todos los valores en texto.
        </desc>
        <g className="compare-radar-grid" fill="none">
          {rings.map((points, i) => (
            <polygon key={`ring-${i}`} points={points} />
          ))}
          {spokes.map((point, i) => (
            <line
              key={`spoke-${i}`}
              x1={RADAR_C}
              y1={RADAR_C}
              x2={point.x}
              y2={point.y}
            />
          ))}
        </g>
        {series.map((s) => (
          <g key={s.perfume.id} className="compare-radar-series">
            <polygon points={s.points} fill={s.color} stroke={s.color} />
            <title>{s.title}</title>
          </g>
        ))}
        <g className="compare-radar-labels" textAnchor="middle">
          {labels.map((label) => (
            <text key={label.name} x={label.at.x} y={label.at.y}>
              {label.name}
            </text>
          ))}
        </g>
      </svg>
      {truncated && (
        <p className="compare-radar-truncated">
          Se muestran los 6 acordes más intensos del conjunto; el resto está en
          la tabla de acordes.
        </p>
      )}
      {absentAxes.length > 0 && (
        <p className="compare-radar-absent">
          Un perfume sin un acorde dibuja su vértice en el centro: es ausencia
          del acorde, no intensidad 0. La tabla de acordes lo marca con un
          guion (—). {absentAxes.length === 1 ? `Acorde afectado: ${absentAxes[0]}.` : `Acordes afectados: ${absentAxes.join(", ")}.`}
        </p>
      )}
    </div>
  );
}

/** Notas de un perfume agrupadas por fase, en orden fijo top → heart → base. */
function notesByPhase(perfume: Perfume): string[] {
  const phases = new Map<string, string[]>();
  for (const note of perfume.notes ?? []) {
    const list = phases.get(note.noteType) ?? [];
    list.push(note.note.name);
    phases.set(note.noteType, list);
  }
  return NOTE_ORDER.flatMap((phase) => {
    const names = phases.get(phase);
    return names && names.length > 0 ? [names.join(", ")] : [];
  });
}

/** Valor ausente: guion a la vista y "Sin dato" para lectores de pantalla (ausente ≠ 0). */
function Absent() {
  return (
    <>
      <span className="compare-dash" aria-hidden="true">
        —
      </span>
      <span className="sr-only">{NO_DATA}</span>
    </>
  );
}

function DiffRow({
  label,
  values,
  lang,
}: {
  label: string;
  values: Array<string | null>;
  /** Idioma del contenido de las celdas si no es el de la página (ej. las notas están en inglés). */
  lang?: string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {values.map((value, i) => (
        <td key={i} lang={value === null ? undefined : lang}>
          {value ?? <Absent />}
        </td>
      ))}
    </tr>
  );
}

function DifferencesTable({ perfumes }: { perfumes: Perfume[] }) {
  return (
    <div className="compare-table-scroll" role="region" aria-label="Comparación de atributos, desplazable" tabIndex={0}>
    <table className="compare-table">
      <caption>Comparación de atributos</caption>
      <thead>
        <tr>
          <th scope="col">Atributo</th>
          {perfumes.map((p) => (
            <th scope="col" key={p.id}>
              {p.brand} {p.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <DiffRow
          label="Concentración"
          values={perfumes.map((p) => p.concentration?.toUpperCase() ?? null)}
        />
        <DiffRow
          label="Género"
          values={perfumes.map((p) => p.gender)}
        />
        <DiffRow
          label="Duración (h)"
          values={perfumes.map((p) => (p.duration === null || p.duration === undefined ? null : `${p.duration}`))}
        />
        <DiffRow
          label="Proyección (1-4)"
          values={perfumes.map((p) => (p.projection === null || p.projection === undefined ? null : `${p.projection}`))}
        />
        <DiffRow
          label="Estaciones"
          values={perfumes.map((p) => (p.seasons.length > 0 ? p.seasons.join(", ") : null))}
        />
        <DiffRow
          label="Ocasiones"
          values={perfumes.map((p) => (p.occasions.length > 0 ? p.occasions.join(", ") : null))}
        />
        <DiffRow
          label="Notas (top → base)"
          lang="en"
          values={perfumes.map((p) => {
            const phases = notesByPhase(p);
            return phases.length > 0 ? phases.join(" · ") : null;
          })}
        />
      </tbody>
    </table>
    </div>
  );
}

/** Tabla de acordes con intensidad: la gemela textual del radar. */
function AccordsTable({ perfumes }: { perfumes: Perfume[] }) {
  const accordNames = new Set<string>();
  for (const p of perfumes) {
    for (const a of p.accords ?? []) accordNames.add(a.accord.name);
  }
  const rows = [...accordNames].sort((a: string, b: string) => a.localeCompare(b, "es"));

  return (
    <div className="compare-table-scroll" role="region" aria-label="Acordes e intensidad, desplazable" tabIndex={0}>
    <table className="compare-table">
      <caption>Acordes e intensidad (0-100)</caption>
      <thead>
        <tr>
          <th scope="col">Acorde</th>
          {perfumes.map((p) => (
            <th scope="col" key={p.id}>
              {p.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((name) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            {perfumes.map((p) => {
              const accord = (p.accords ?? []).find((a) => a.accord.name === name);
              // Ausente ≠ intensidad 0 (spec RF-03): sin barra, con guion.
              return (
                <td key={p.id}>
                  {accord ? (
                    <span className="compare-bar-cell">
                      <span className="compare-bar-value">{accord.intensity}</span>
                      <span className="accord-meter" aria-hidden="true">
                        <span style={{ width: `${accord.intensity}%` }} />
                      </span>
                    </span>
                  ) : (
                    <Absent />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export const metadata = { title: "Comparador" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawIds = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const ids = (rawIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return (
    <main id="contenido" className="compare">
      <Link className="back-link" href="/perfumes">
        ← Catálogo
      </Link>
      <header className="compare-header">
        <p className="eyebrow">Comparador</p>
        <h1>Comparando {ids.length > 0 ? ids.length : ""} perfumes</h1>
      </header>

      {/* Sin ids o formato inválido: estado vacío con formato correcto. */}
      {ids.length < 2 && (
        <div className="compare-empty">
          <p className="compare-empty-title">
            {ids.length === 1
              ? "Se necesitan al menos 2 perfumes para comparar."
              : "Elegí entre 2 y 4 perfumes para comparar."}
          </p>
          <p>
            Desde el catálogo, marcá los perfumes con el selector de comparación
            y usá el botón “Comparar”. O compartí un link con el formato{" "}
            <code>?ids=id1,id2</code>.
          </p>
          <p>
            <Link className="button" href="/perfumes">
              Volver al catálogo
            </Link>
          </p>
        </div>
      )}

      {ids.length > 4 && (
        <div className="compare-empty">
          <p className="compare-empty-title">
            Se pueden comparar hasta 4 perfumes; recibimos {ids.length}.
          </p>
          <p>
            <Link className="button" href="/perfumes">
              Volver al catálogo
            </Link>
          </p>
        </div>
      )}

      {ids.length >= 2 && ids.length <= 4 && <CompareContent ids={ids.join(",")} />}
    </main>
  );
}

async function CompareContent({ ids }: { ids: string }) {
  const { perfumes, missing, error } = await fetchCompare(ids);

  if (error) {
    return (
      <div className="compare-empty">
        <p className="compare-empty-title">{error}</p>
        <p>
          <Link className="button" href="/perfumes">
            Volver al catálogo
          </Link>
        </p>
      </div>
    );
  }

  // Ids inexistentes: bloque explícito por cada uno — el link compartido no
  // rompe, y no se infiere ni inventa nada sobre lo ausente.
  if (missing.length > 0) {
    return (
      <div className="compare-missing">
        <p role="alert">
          {missing.length === 1
            ? "No encontramos ese perfume en el catálogo."
            : "No encontramos algunos perfumes en el catálogo."}{" "}
          (ids: {missing.join(", ")})
        </p>
        <p>
          <Link className="button" href="/perfumes">
            Volver al catálogo
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <section aria-label={`Comparando ${perfumes.length} perfumes`}>
        <ul className="compare-cards">
          {perfumes.map((perfume, index) => (
            <li key={perfume.id}>
              <IdentityCard
                perfume={perfume}
                index={index}
                ids={perfumes.map((p) => p.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {perfumes.length >= 2 && (
        <section aria-label="Radar de acordes">
          <RadarChart perfumes={perfumes} />
          <ul className="compare-legend">
            {perfumes.map((p, index) => (
              <li key={p.id}>
                <span
                  className="compare-swatch"
                  style={{ background: seriesColor(index) }}
                  aria-hidden="true"
                />
                {p.brand} {p.name}
                {p.concentration ? ` — ${p.concentration.toUpperCase()}` : ""}
                {p.releaseYear ? ` ${p.releaseYear}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AccordsTable perfumes={perfumes} />
      <DifferencesTable perfumes={perfumes} />
    </>
  );
}
