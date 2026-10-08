import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { getDailyPerfume } from "@/lib/daily/pick";
import { PerfumeCover } from "@/app/perfumes/PerfumeCover";
import { AccordBars, NotePyramid } from "@/app/perfumes/PerfumeProfile";
import { PerfumeTile } from "@/app/perfumes/PerfumeTile";
import { StreakCard } from "@/app/StreakCard";
import { genderLabel } from "@/app/perfumes/types";
import { hueForAccord } from "@/lib/cover";
import { seasonFor, DEFAULT_HEMISPHERE } from "@/lib/daily/daily";
import { getCatalogStats, getSeasonalFeatured, getTopAccords } from "@/lib/home/featured";
import { getWearOptions, getWearSummary } from "@/lib/wear/data";

const SEASON_LABELS = {
  primavera: "la primavera",
  verano: "el verano",
  otoño: "el otoño",
  invierno: "el invierno",
} as const;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Cada bloque falla por separado: un dato que no carga no debe tumbar la portada.
const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const dbUserId = await getSessionDbUserId();

  const daily = await safe(getDailyPerfume({ userId: dbUserId }), null);
  const season = daily?.season ?? seasonFor(new Date(), DEFAULT_HEMISPHERE);
  const [stats, featured, topAccords, wear, wearOptions] = await Promise.all([
    safe(getCatalogStats(), null),
    safe(getSeasonalFeatured(season, 8, daily ? [daily.perfumeId] : []), []),
    safe(getTopAccords(14), []),
    dbUserId ? safe(getWearSummary(dbUserId), null) : Promise.resolve(null),
    dbUserId ? safe(getWearOptions(dbUserId), []) : Promise.resolve([]),
  ]);
  const racha = first(params.racha);
  const notice = racha === "ok" || racha === "error" ? racha : undefined;

  return (
    <main id="contenido" className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <p className="eyebrow">Catálogo editorial de perfumes</p>
        <h1 id="home-title">
          Elegí un perfume con más <em>contexto</em>.
        </h1>
        <p className="lead">
          Explorá más de veinte mil perfumes por sus acordes, compará hasta cuatro, armá tu colección privada y
          descubrí cuál va con vos.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/perfumes">
            Explorar el catálogo
          </Link>
          <Link className="button button-ghost" href="/quiz">
            Descubrí tu perfil olfativo
          </Link>
          {!user && (
            <Link className="button button-ghost" href="/login">
              Ingresar
            </Link>
          )}
        </div>
      </section>

      {stats && (
        <dl className="home-stats" aria-label="El catálogo en números">
          <div>
            <dt>Perfumes</dt>
            <dd>{stats.perfumes.toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt>Marcas</dt>
            <dd>{stats.brands.toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{stats.notes.toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt>Acordes</dt>
            <dd>{stats.accords.toLocaleString("es-AR")}</dd>
          </div>
        </dl>
      )}

      <StreakCard summary={user ? wear : null} options={wearOptions} notice={notice} />

      {daily && (
        <section className="home-daily" aria-labelledby="daily-title">
          <PerfumeCover
            name={daily.name}
            accords={daily.accordBars.map((a) => ({ intensity: a.intensity, accord: { name: a.name } }))}
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
              <AccordBars accords={daily.accordBars} />
              <h3>Notas</h3>
              <NotePyramid notes={daily.notes} />
            </div>
            <p className="perfume-meta">
              {daily.personalized
                ? `Elegido para vos${
                    daily.matchedAccords.length > 0 ? `: coincide con tu perfil en ${daily.matchedAccords.join(", ")}` : ""
                  }.`
                : `Una elección para ${SEASON_LABELS[daily.season]}.`}
            </p>
            <Link className="home-daily-link" href={`/perfumes/${daily.perfumeId}`}>
              Ver la ficha →
            </Link>
          </div>
        </section>
      )}

      {featured.length > 0 && (
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
      )}

      {topAccords.length > 0 && (
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
                    style={{ background: `hsl(${hueForAccord(accord.name).hue} 45% 62%)` }}
                    aria-hidden="true"
                  />
                  {accord.name.charAt(0).toUpperCase() + accord.name.slice(1)}
                  <small>{accord.count.toLocaleString("es-AR")}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-features" aria-label="Qué podés hacer">
        <article className="home-feature">
          <span className="home-feature-index" aria-hidden="true">
            01
          </span>
          <h2>Explorá</h2>
          <p>Buscá por nombre, marca, acorde, nota o estación entre más de 23.000 perfumes.</p>
          <Link href="/perfumes">Ver el catálogo →</Link>
        </article>
        <article className="home-feature">
          <span className="home-feature-index" aria-hidden="true">
            02
          </span>
          <h2>Descubrí</h2>
          <p>Seis preguntas sobre lo que te gusta y te mostramos los perfumes que mejor encajan con tu perfil.</p>
          <Link href="/quiz">Hacer el quiz →</Link>
        </article>
        <article className="home-feature">
          <span className="home-feature-index" aria-hidden="true">
            03
          </span>
          <h2>Organizá</h2>
          <p>Guardá lo que tenés, lo que probaste y lo que querés, con tus notas y puntuación. Es privado.</p>
          <Link href={user ? "/mi-coleccion" : "/login"}>{user ? "Ir a mi colección →" : "Ingresar →"}</Link>
        </article>
      </section>
    </main>
  );
}
