import { Suspense } from "react";
import Link from "next/link";

import { Skeleton } from "@/components/Skeleton";
import { AccordsSection, DailySection, FeaturedSection, HeroAuthButton, PersonalSection, StatsSection } from "./home-sections";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// La portada se arma por partes: lo estático (título, botones, accesos) sale de inmediato y cada sección con datos
// llega por separado, con un marcador mientras tanto.
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const racha = first((await searchParams).racha);
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
          <Suspense fallback={<Skeleton style={{ width: "6.5rem", height: "2.75rem" }} />}>
            <HeroAuthButton />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<Skeleton style={{ height: "7rem", borderRadius: "1rem" }} />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "12rem", borderRadius: "1.25rem" }} />}>
        <PersonalSection notice={notice} />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "30rem", borderRadius: "1.25rem" }} />}>
        <DailySection />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "22rem", borderRadius: "1rem" }} />}>
        <FeaturedSection />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "9rem", borderRadius: "1rem" }} />}>
        <AccordsSection />
      </Suspense>

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
          <Link href="/mi-coleccion">Ir a mi colección →</Link>
        </article>
      </section>
    </main>
  );
}
