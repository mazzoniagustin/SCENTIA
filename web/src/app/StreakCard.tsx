import Link from "next/link";

import { logWearAction } from "@/app/actions/wear";
import { PerfumeImage } from "@/app/perfumes/PerfumeImage";
import { WearSubmit } from "@/app/WearSubmit";
import type { WearSummary } from "@/lib/wear/data";

type Option = { perfumeId: string; brand: string; name: string; imageUrl?: string | null };

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

// Racha de uso: días seguidos registrando el perfume que usás. Con sesión se registra el de hoy; sin sesión es una invitación.
export function StreakCard({
  summary,
  options,
  collectionTotal = 0,
  notice,
}: {
  summary: WearSummary | null;
  options: Option[];
  /** Perfumes en la colección (de cualquier estado): para explicar por qué no hay nada que elegir. */
  collectionTotal?: number;
  notice?: "ok" | "error";
}) {
  if (!summary) {
    return (
      <section className="streak-card" id="racha" aria-labelledby="streak-title">
        <div>
          <p className="eyebrow" id="streak-title">
            Tu racha
          </p>
          <h2>Un perfume por día, una racha que crece.</h2>
          <p className="streak-lead">
            Registrá qué perfume de tu colección usás cada día y sumá días seguidos.
          </p>
        </div>
        <Link className="button" href="/login">
          Ingresar para empezar
        </Link>
      </section>
    );
  }

  const { streak, today, recent } = summary;
  return (
    <section className="streak-card" id="racha" aria-labelledby="streak-title" data-done={streak.loggedToday}>
      <div className="streak-figures">
        <p className="eyebrow" id="streak-title">
          Tu racha
        </p>
        <p className="streak-count">
          <span aria-hidden="true">{streak.current}</span>
          <span className="sr-only">{plural(streak.current, "día seguido", "días seguidos")}</span>
          <small aria-hidden="true">{streak.current === 1 ? "día" : "días"}</small>
        </p>
        {recent.length > 0 && (
          <ol className="streak-week" aria-label="Últimos 7 días">
            {recent.map((d) => (
              <li key={d.day} className="streak-day" data-logged={d.logged} data-today={d.isToday}>
                <span className="streak-dot" aria-hidden="true" />
                <span className="streak-day-initial" aria-hidden="true">
                  {WEEKDAY_INITIALS[d.weekday]}
                </span>
                <span className="sr-only">
                  {WEEKDAY_NAMES[d.weekday]} {Number(d.day.slice(8))}
                  {d.isToday ? " (hoy)" : ""}: {d.logged ? "usaste un perfume" : "sin registro"}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="streak-lead">
          Mejor racha: {plural(streak.best, "día", "días")} · Total: {plural(streak.total, "día registrado", "días registrados")}
        </p>
      </div>

      <div className="streak-today">
        {notice === "ok" && (
          <p className="notice" role="status">
            ¡Listo! Registramos tu perfume de hoy.
          </p>
        )}
        {notice === "error" && (
          <p className="error-message" role="alert">
            No pudimos registrar ese perfume. Tiene que estar en tu colección como “Lo tengo” o “Probé una muestra”.
          </p>
        )}

        {today && (
          <p className="streak-done">
            Hoy usás <strong>{today.name}</strong> <span>({today.brand})</span>.
          </p>
        )}

        {options.length === 0 ? (
          collectionTotal === 0 ? (
            <p className="streak-lead">
              Tu colección está vacía. Guardá un perfume desde el <Link href="/perfumes">catálogo</Link> con el estado “Lo tengo” o “Probé una
              muestra” y vas a poder registrarlo acá.
            </p>
          ) : (
            <p className="streak-lead">
              Tenés {collectionTotal} {collectionTotal === 1 ? "perfume" : "perfumes"} en tu colección, pero ninguno figura como “Lo tengo” o
              “Probé una muestra”. Cambiá el estado en <Link href="/mi-coleccion">Mi colección</Link> para poder registrarlo.
            </p>
          )
        ) : (
          <form className="streak-form" action={logWearAction}>
            <fieldset className="wear-picker">
              <legend>{today ? "Cambiar el perfume de hoy" : "¿Qué perfume usás hoy?"}</legend>
              <div className="wear-options">
                {options.map((o) => (
                  <label key={o.perfumeId} className="wear-option">
                    <input
                      className="sr-only"
                      type="radio"
                      name="perfumeId"
                      value={o.perfumeId}
                      defaultChecked={today?.perfumeId === o.perfumeId}
                      required
                    />
                    <PerfumeImage name={o.name} brand={o.brand} imageUrl={o.imageUrl} size="thumb" />
                    <span className="wear-option-text">
                      <small>{o.brand}</small>
                      <span>{o.name}</span>
                    </span>
                    <span className="wear-option-mark" aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
            <WearSubmit label={today ? "Actualizar" : "Registrar hoy"} />
          </form>
        )}
      </div>
    </section>
  );
}
