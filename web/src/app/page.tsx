import { Suspense } from "react";
import Link from "next/link";

import { BrandImage } from "@/components/BrandImage";
import { LoadingPanel } from "@/components/LoadBar";
import { Skeleton } from "@/components/Skeleton";
import { AccordsSection, CatalogCount, DailySection, FeaturedSection, PersonalSection, StatsSection } from "./home-sections";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// La portada se arma por partes: lo estático (título, botones, accesos) sale de inmediato y cada sección con datos
// llega por separado, con un marcador mientras tanto.
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const racha = first((await searchParams).racha);
  const notice = racha === "ok" || racha === "error" || racha === "limite" ? racha : undefined;

  return (
    <main id="contenido" className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <BrandImage slot="hero" className="home-hero-art" priority />
        <h1 id="home-title">
          Elegí un perfume con más contexto.
        </h1>
        <p className="lead">
          Explorá{" "}
          <Suspense fallback="miles de">
            <CatalogCount />
          </Suspense>{" "}
          perfumes por sus acordes, compará hasta cuatro, armá tu colección privada y descubrí cuál va con vos.
        </p>
        {/* Formulario GET al catálogo con el parámetro `q` que ya existe (nombre o marca): funciona sin JavaScript. */}
        <form className="hero-search" action="/perfumes" method="get" role="search">
          <label htmlFor="hero-q" className="sr-only">
            Buscar perfumes por nombre o marca
          </label>
          <input
            id="hero-q"
            className="hero-search-input"
            type="search"
            name="q"
            placeholder="Ej.: Sauvage o Dior…"
            maxLength={80}
            autoComplete="off"
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="landing-actions">
          <Link className="button" href="/quiz">
            Descubrí tu perfil olfativo
          </Link>
          <Link className="home-secondary-link" href="/perfumes">
            o explorá el catálogo completo →
          </Link>
        </div>
      </section>

      <Suspense fallback={<Skeleton style={{ height: "7rem", borderRadius: "1rem" }} />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "12rem", borderRadius: "1.25rem" }} />}>
        <PersonalSection notice={notice} />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Eligiendo el perfume del día…" minHeight="24rem" />}>
        <DailySection />
      </Suspense>

      <Suspense fallback={<LoadingPanel label="Buscando los perfumes de la estación…" minHeight="22rem" />}>
        <FeaturedSection />
      </Suspense>

      <Suspense fallback={<Skeleton style={{ height: "9rem", borderRadius: "1rem" }} />}>
        <AccordsSection />
      </Suspense>

      <section className="home-features" aria-label="Qué podés hacer">
        <article className="home-feature">
          <h2>Explorá</h2>
          <p>
            Buscá por nombre, marca, acorde, nota o estación entre{" "}
            <Suspense fallback="miles de">
              <CatalogCount />
            </Suspense>{" "}
            perfumes.
          </p>
          <Link href="/perfumes">Ver el catálogo →</Link>
        </article>
        <article className="home-feature">
          <h2>Descubrí</h2>
          <p>Respondé unas preguntas sobre lo que te gusta y te mostramos los perfumes que mejor encajan con tu perfil.</p>
          <Link href="/quiz">Hacer el quiz →</Link>
        </article>
        <article className="home-feature">
          <h2>Organizá</h2>
          <p>Guardá lo que tenés, lo que probaste y lo que querés, con tus notas y puntuación. Es privado.</p>
          <Link href="/mi-coleccion">Ir a mi colección →</Link>
        </article>
      </section>
    </main>
  );
}
