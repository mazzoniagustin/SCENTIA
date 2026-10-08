import Link from "next/link";

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
      <main className="catalog">
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

  const results = await recommendFromAnswers(validated.answers, {
    gender,
    limit: RESULT_LIMIT,
    userId: await getSessionDbUserId(),
  });

  // Para el filtro de género se reenvían las mismas respuestas como campos ocultos.
  const hiddenFields = QUESTIONS.flatMap((question) => {
    const value = validated.answers[question.id];
    return (Array.isArray(value) ? value : [value]).map((v) => ({ name: question.id, value: v }));
  });

  return (
    <main className="catalog">
      <Link className="back-link" href="/quiz">
        ← Rehacer el quiz
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Quiz</p>
        <h1>Tus recomendaciones</h1>
      </header>

      <form className="catalog-filters quiz-gender" action="/quiz/resultado" method="GET">
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
                <p className="perfume-brand">{result.brand}</p>
                <h2 className="perfume-name">{result.name}</h2>
                <p className="perfume-meta">
                  {result.gender.charAt(0).toUpperCase() + result.gender.slice(1)} · afinidad{" "}
                  {Math.round(result.score * 100)}%
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
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
