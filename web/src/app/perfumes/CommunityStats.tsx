import Link from "next/link";

import {
  LONGEVITY_LABELS, PRICE_VALUE_LABELS, SILLAGE_LABELS, scaleLabel, scalePercent, shares,
} from "@/lib/community";
import type { Stats } from "@/lib/import/kaggle-fragrantica";

type Props = { longevity: number | null; sillage: number | null; stats: unknown };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// Lo que la comunidad vota (duración, estela, estaciones, día/noche). Los datos vienen de un JSON: se leen con cuidado.
function readStats(raw: unknown): Stats | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, Record<string, unknown> | number | null>;
  const seasons = (s.seasons ?? {}) as Record<string, unknown>;
  const daypart = (s.daypart ?? {}) as Record<string, unknown>;
  return {
    people: num(s.people), have: num(s.have), had: num(s.had), want: num(s.want),
    priceValue: typeof s.priceValue === "number" ? s.priceValue : null,
    histograms: { rating: [], longevity: [], sillage: [], priceValue: [] },
    communityGender: { female: 0, femaleLeaning: 0, unisex: 0, maleLeaning: 0, male: 0 },
    seasons: { winter: num(seasons.winter), spring: num(seasons.spring), summer: num(seasons.summer), autumn: num(seasons.autumn) },
    daypart: { day: num(daypart.day), night: num(daypart.night) },
  };
}

function Bar({ label, value, caption, percent }: { label: string; value: string; caption?: string; percent: number }) {
  return (
    <li>
      <span>{label}</span>
      <span className="ficha-bar" role="img" aria-label={`${label}: ${value}${caption ? `, ${caption}` : ""}`}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <small>{value}</small>
    </li>
  );
}

export function CommunityStats({ longevity, sillage, stats: rawStats }: Props) {
  const stats = readStats(rawStats);
  if (!stats && longevity === null && sillage === null) return null;

  const seasonShares = stats ? shares(stats.seasons) : null;
  const dayShares = stats ? shares(stats.daypart) : null;
  const seasonRows: Array<[string, keyof Stats["seasons"]]> = [["Primavera", "spring"], ["Verano", "summer"], ["Otoño", "autumn"], ["Invierno", "winter"]];

  return (
    <section className="ficha-section" aria-labelledby="ficha-comunidad">
      <h2 id="ficha-comunidad">Según la comunidad</h2>
      <ul className="community-bars">
        {longevity !== null && <Bar label="Duración" value={scaleLabel(longevity, LONGEVITY_LABELS)} percent={scalePercent(longevity, 5)} />}
        {sillage !== null && <Bar label="Estela" value={scaleLabel(sillage, SILLAGE_LABELS)} percent={scalePercent(sillage, 4)} />}
        {stats?.priceValue != null && <Bar label="Precio" value={scaleLabel(stats.priceValue, PRICE_VALUE_LABELS)} percent={scalePercent(stats.priceValue, 5)} />}
      </ul>

      {seasonShares && dayShares && stats && Object.values(stats.seasons).reduce((a, b) => a + b, 0) > 0 && (
        <div className="community-split">
          <div>
            <h3>Estaciones</h3>
            <ul className="community-bars">
              {seasonRows.map(([label, k]) => (
                <Bar key={k} label={label} value={`${seasonShares[k]} %`} percent={seasonShares[k]} />
              ))}
            </ul>
          </div>
          <div>
            <h3>Momento del día</h3>
            <ul className="community-bars">
              <Bar label="Día" value={`${dayShares.day} %`} percent={dayShares.day} />
              <Bar label="Noche" value={`${dayShares.night} %`} percent={dayShares.night} />
            </ul>
          </div>
        </div>
      )}

      {stats && stats.have + stats.had + stats.want > 0 && (
        <p className="community-relation">
          {stats.have.toLocaleString("es-AR")} lo tienen · {stats.had.toLocaleString("es-AR")} lo tuvieron · {stats.want.toLocaleString("es-AR")} lo quieren
        </p>
      )}
      <p className="community-source">
        Votos de la comunidad de Fragrantica, tomados de un dataset de Kaggle (CC BY-NC-SA 4.0). <Link href="/creditos">Ver créditos</Link>.
      </p>
    </section>
  );
}
