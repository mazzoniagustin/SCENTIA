import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { getDailyPerfume } from "@/lib/daily/pick";

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
    <main id="contenido" className="landing">
      <div className="landing-content">
        <p className="eyebrow">Catálogo editorial de perfumes</p>
        <h1>
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
          <Link className="button" href="/quiz">
            Descubrí tu perfil olfativo
          </Link>
          <Link className="button" href={user ? "/account" : "/login"}>
            {user ? "Ver mi cuenta" : "Ingresar"}
          </Link>
        </div>

        {daily && (
          <section className="daily-card" aria-labelledby="daily-title">
            <p className="eyebrow" id="daily-title">
              Perfume del día
            </p>
            <h2 className="perfume-name">
              <Link href={`/perfumes/${daily.perfumeId}`}>{daily.name}</Link>
            </h2>
            <p className="perfume-brand">{daily.brand}</p>
            {daily.accords.length > 0 && (
              <ul className="perfume-badges" aria-label="Acordes principales">
                {daily.accords.map((accord) => (
                  <li key={accord}>{accord}</li>
                ))}
              </ul>
            )}
            <p className="perfume-meta">
              {daily.personalized
                ? `Elegido para vos${
                    daily.matchedAccords.length > 0 ? `: coincide con tu perfil en ${daily.matchedAccords.join(", ")}` : ""
                  }.`
                : `Una elección para ${SEASON_LABELS[daily.season]}.`}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
