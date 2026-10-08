import Link from "next/link";

import { logWearAction } from "@/app/actions/wear";
import type { WearSummary } from "@/lib/wear/data";

type Option = { perfumeId: string; brand: string; name: string };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

// Racha de uso: días seguidos registrando el perfume que usás. Con sesión se registra el de hoy; sin sesión es una invitación.
export function StreakCard({
  summary,
  options,
  notice,
}: {
  summary: WearSummary | null;
  options: Option[];
  notice?: "ok" | "error";
}) {
  if (!summary) {
    return (
      <section className="streak-card" aria-labelledby="streak-title">
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

  const { streak, today } = summary;
  return (
    <section className="streak-card" aria-labelledby="streak-title">
      <div className="streak-figures">
        <p className="eyebrow" id="streak-title">
          Tu racha
        </p>
        <p className="streak-count">
          <span aria-hidden="true">{streak.current}</span>
          <span className="sr-only">{plural(streak.current, "día seguido", "días seguidos")}</span>
          <small aria-hidden="true">{streak.current === 1 ? "día" : "días"}</small>
        </p>
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
          <p className="streak-lead">
            Para registrar tu uso diario, marcá perfumes como “Lo tengo” o “Probé una muestra” en el{" "}
            <Link href="/perfumes">catálogo</Link>.
          </p>
        ) : (
          <form className="streak-form" action={logWearAction}>
            <label>
              {today ? "Cambiar el perfume de hoy" : "¿Qué perfume usás hoy?"}
              <select name="perfumeId" defaultValue={today?.perfumeId ?? ""} required>
                <option value="" disabled>
                  Elegí de tu colección
                </option>
                {options.map((o) => (
                  <option key={o.perfumeId} value={o.perfumeId}>
                    {o.brand} · {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">{today ? "Actualizar" : "Registrar hoy"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
