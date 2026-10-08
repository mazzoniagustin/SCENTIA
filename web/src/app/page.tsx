import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { getDailyPerfume } from "@/lib/daily/pick";
import { PerfumeCover } from "@/app/perfumes/PerfumeCover";
import { AccordBars, NotePyramid } from "@/app/perfumes/PerfumeProfile";
import { genderLabel } from "@/app/perfumes/types";

const SEASON_LABELS = {
  primavera: "la primavera",
  verano: "el verano",
  otoño: "el otoño",
  invierno: "el invierno",
} as const;

export default async function Home() {
  const user = await getCurrentUser();
  // El perfume del día no debe tumbar la portada si la base no responde.
  const daily = await getDailyPerfume({ userId: await getSessionDbUserId() }).catch(() => null);

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

      <footer className="home-footer">
        <p>Scentia es un proyecto personal de aprendizaje.</p>
      </footer>
    </main>
  );
}
