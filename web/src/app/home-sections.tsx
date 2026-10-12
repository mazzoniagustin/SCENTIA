import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { getDailyPerfume } from "@/lib/daily/pick";
import { PerfumeImage } from "@/app/perfumes/PerfumeImage";
import { AccordBars, NotePyramid } from "@/app/perfumes/PerfumeProfile";
import { PerfumeTile } from "@/app/perfumes/PerfumeTile";
import { StreakCard } from "@/app/StreakCard";
import { genderLabel } from "@/app/perfumes/types";
import { cache } from "react";
import { CountUp } from "@/components/CountUp";
import { accordDotColor } from "@/lib/cover";
import { seasonFor, DEFAULT_HEMISPHERE } from "@/lib/daily/daily";
import { getCatalogStats, getSeasonalFeatured, getTopAccords } from "@/lib/home/featured";
import { getCollectionOverview, getWearOptions, getWearSummary, type WearSummary } from "@/lib/wear/data";

// Secciones de la portada. Cada una se carga aparte (dentro de su <Suspense> en page.tsx): el título y los botones
// aparecen al instante y lo demás llega a medida que está listo. Cada bloque falla por separado.

const SEASON_LABELS = {
  primavera: "la primavera",
  verano: "el verano",
  otoño: "el otoño",
  invierno: "el invierno",
} as const;

/** Versión liviana del perfume del día: hasta 2 notas por piso (6 en total) o 6 si no hay pirámide. */
function lightNotes(notes: Array<{ noteType: string; name: string }>) {
  const hasTiers = notes.some((n) => n.noteType !== "flat");
  const perGroup = hasTiers ? 2 : 6;
  const counts = new Map<string, number>();
  return notes.filter((n) => {
    const c = counts.get(n.noteType) ?? 0;
    counts.set(n.noteType, c + 1);
    return c < perGroup;
  });
}

const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);

const EMPTY_WEAR: WearSummary = { streak: { current: 0, best: 0, loggedToday: false, total: 0 }, recent: [], today: null, day: "" };

/** El perfume del día se pide una sola vez por solicitud aunque lo usen varias secciones. */
const getDaily = cache(async () => safe(getDailyPerfume({ userId: await getSessionDbUserId() }), null));

/** Cantidad de perfumes del catálogo: el mismo dato (`getCatalogStats`) para el hero, la barra de cifras y las tarjetas de acciones. */
export async function CatalogCount() {
  const stats = await safe(getCatalogStats(), null);
  return <>{stats ? stats.perfumes.toLocaleString("es-AR") : "miles de"}</>;
}

export async function StatsSection() {
  const stats = await safe(getCatalogStats(), null);
  if (!stats) return null;
  return (
      <dl className="home-stats" aria-label="El catálogo en números">
        <div>
          <dt>Perfumes</dt>
          <dd><CountUp value={stats.perfumes} /></dd>
        </div>
        <div>
          <dt>Marcas</dt>
          <dd><CountUp value={stats.brands} /></dd>
        </div>
        <div>
          <dt>Notas</dt>
          <dd><CountUp value={stats.notes} /></dd>
        </div>
        <div>
          <dt>Acordes</dt>
          <dd><CountUp value={stats.accords} /></dd>
        </div>
      </dl>
  );
}

export async function PersonalSection({ notice }: { notice?: "ok" | "error" | "limite" }) {
  const user = await getCurrentUser();
  const dbUserId = user ? await getSessionDbUserId() : null;
  const [wear, wearOptions, overview] = await Promise.all([
    dbUserId ? safe(getWearSummary(dbUserId), null) : Promise.resolve(null),
    dbUserId ? safe(getWearOptions(dbUserId), []) : Promise.resolve([]),
    dbUserId ? safe(getCollectionOverview(dbUserId), { total: 0, wearable: 0 }) : Promise.resolve({ total: 0, wearable: 0 }),
  ]);
  // Con sesión pero sin fila en la base todavía (nunca guardó nada): racha en cero, no la invitación a ingresar.
  const summary: WearSummary | null = user ? (wear ?? EMPTY_WEAR) : null;
  return <StreakCard summary={summary} options={wearOptions} collectionTotal={overview.total} notice={notice} />;
}

export async function DailySection() {
  const daily = await getDaily();
  if (!daily) return null;
  return (
      <section className="home-daily" aria-labelledby="daily-title">
        <PerfumeImage
          name={daily.name}
          brand={daily.brand}
          imageUrl={daily.imageUrl}
          accords={daily.accordBars.map((a) => ({ intensity: a.intensity, accord: { name: a.name } }))}
          size="hero"
        />
        <div className="home-daily-body">
          <p className="eyebrow" id="daily-title">
            Perfume del día
          </p>
          <h2 className="perfume-name">
            <Link href={`/perfumes/${daily.perfumeId}`}>{daily.name}</Link>
          </h2>
          <p className="perfume-brand">
            {daily.brand} · {genderLabel(daily.gender)}
          </p>
          <div className="home-daily-profile">
            <h3>Acordes principales</h3>
            <AccordBars accords={daily.accordBars.slice(0, 4)} />
            <h3>Notas</h3>
            <NotePyramid notes={lightNotes(daily.notes)} />
          </div>
          <p className="perfume-meta">
            {daily.personalized
              ? `Elegido para vos${
                  daily.matchedAccords.length > 0 ? `: coincide con tu perfil en ${daily.matchedAccords.join(", ")}` : ""
                }.`
              : `Una elección para ${SEASON_LABELS[daily.season]}.`}
          </p>
          <Link className="home-daily-link" href={`/perfumes/${daily.perfumeId}`}>
            Ver la ficha completa →
          </Link>
        </div>
      </section>
  );
}

export async function FeaturedSection() {
  const daily = await getDaily();
  const season = daily?.season ?? seasonFor(new Date(), DEFAULT_HEMISPHERE);
  const featured = await safe(getSeasonalFeatured(season, 8, daily ? [daily.perfumeId] : []), []);
  if (featured.length === 0) return null;
  return (
      <section className="home-section" aria-labelledby="featured-title">
        <div className="home-section-head">
          <h2 id="featured-title">
            Para {SEASON_LABELS[season]}
          </h2>
          <Link href={`/perfumes?season=${season}`}>Ver todos →</Link>
        </div>
        <div className="home-tiles">
          {featured.map((perfume) => (
            <PerfumeTile key={perfume.id} perfume={perfume} />
          ))}
        </div>
      </section>
  );
}

export async function AccordsSection() {
  const topAccords = await safe(getTopAccords(14), []);
  if (topAccords.length === 0) return null;
  return (
      <section className="home-section" aria-labelledby="accords-title">
        <div className="home-section-head">
          <h2 id="accords-title">Explorá por acorde</h2>
          <Link href="/perfumes">Ver el catálogo →</Link>
        </div>
        <ul className="home-accords">
          {topAccords.map((accord) => (
            <li key={accord.name}>
              <Link href={`/perfumes?accord=${encodeURIComponent(accord.name)}`}>
                <span
                  className="home-accord-dot"
                  style={{ background: accordDotColor(accord.name) }}
                  aria-hidden="true"
                />
                {accord.name.charAt(0).toUpperCase() + accord.name.slice(1)}
                <small>{accord.count.toLocaleString("es-AR")}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
  );
}
