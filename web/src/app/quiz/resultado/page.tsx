import Link from "next/link";

import { saveQuizProfile } from "@/app/actions/account";
import { PerfumeCover } from "@/app/perfumes/PerfumeCover";
import { genderLabel } from "@/app/perfumes/types";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { answersFromSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { QUESTIONS } from "@/lib/quiz/questions";
import { QUIZ_GENDERS, recommendFromAnswers, type QuizGender } from "@/lib/quiz/recommend";

export const metadata = { title: "Tus recomendaciones" };

const RESULT_LIMIT = 12;

type Params = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuizResultPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const validated = validateAnswers(answersFromSearchParams(params));

  if (!validated.ok) {
    return (
      <main id="contenido" className="catalog">
        <Link className="back-link" href="/quiz">
          ← Volver al quiz
        </Link>
        <p className="error-message" role="alert">
          Faltan respuestas para armar tu perfil ({validated.error}). Completá el quiz para ver tus recomendaciones.
        </p>
      </main>
    );
  }

  const genderParam = first(params.gender);
  const gender = (QUIZ_GENDERS as readonly string[]).includes(genderParam ?? "")
    ? (genderParam as QuizGender)
    : undefined;

  const userId = await getSessionDbUserId();
  const results = await recommendFromAnswers(validated.answers, { gender, limit: RESULT_LIMIT, userId });

  // Para el filtro de género se reenvían las mismas respuestas como campos ocultos.
  const hiddenFields = QUESTIONS.flatMap((question) => {
    const value = validated.answers[question.id];
    return (Array.isArray(value) ? value : [value]).map((v) => ({ name: question.id, value: v }));
  });

  return (
    <main id="contenido" className="catalog">
      <Link className="back-link" href="/quiz">
        ← Rehacer el quiz
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Quiz</p>
        <h1>Tus recomendaciones</h1>
      </header>

      {first(params.guardado) === "1" && (
        <p className="notice" role="status">
          Perfil guardado. La próxima vez que entres vas a encontrarlo en el quiz.
        </p>
      )}

      <form className="catalog-filter-bar quiz-gender" action="/quiz/resultado" method="GET">
        {hiddenFields.map((field, i) => (
          <input key={i} type="hidden" name={field.name} value={field.value} />
        ))}
        <label>
          Género
          <select name="gender" defaultValue={gender ?? ""}>
            <option value="">Todos</option>
            {QUIZ_GENDERS.map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="catalog-filters-actions">
          <button type="submit">Aplicar</button>
        </div>
      </form>

      {userId ? (
        <form action={saveQuizProfile}>
          {hiddenFields.map((field, i) => (
            <input key={i} type="hidden" name={field.name} value={field.value} />
          ))}
          {gender && <input type="hidden" name="gender" value={gender} />}
          <button className="button" type="submit">
            Guardar este perfil
          </button>
        </form>
      ) : (
        <p>
          <Link href="/login">Iniciá sesión</Link> para guardar tu perfil.
        </p>
      )}

      {results.length === 0 ? (
        <section className="catalog-empty">
          <p className="catalog-empty-title">No encontramos perfumes para este perfil.</p>
          <p>Probá quitar algún rechazo o cambiar el filtro de género.</p>
        </section>
      ) : (
        <>
          <p className="catalog-count">{results.length} recomendaciones</p>
          <div className="catalog-grid">
            {results.map((result) => (
              <article key={result.perfumeId} className="perfume-card">
                <PerfumeCover
                  name={result.name}
                  accords={result.matchedAccords.map((name, i) => ({ intensity: 100 - i, accord: { name } }))}
                />
                <div className="perfume-card-body">
                  <p className="perfume-brand">{result.brand}</p>
                  <h2 className="perfume-name">
                    <Link href={`/perfumes/${result.perfumeId}`}>{result.name}</Link>
                  </h2>
                  <p className="perfume-meta">
                    {genderLabel(result.gender)} · afinidad {Math.round(result.score * 100)}%
                  </p>
                  {result.matchedAccords.length > 0 && (
                    <ul className="perfume-badges" aria-label="Acordes en común con tu perfil">
                      {result.matchedAccords.map((accord) => (
                        <li key={accord}>{accord}</li>
                      ))}
                    </ul>
                  )}
                  {result.reasons.includes("avoids_rejected") && (
                    <p className="quiz-reason">Evita lo que marcaste como rechazo.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
