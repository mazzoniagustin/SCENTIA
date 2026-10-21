import { Suspense } from "react";
import Link from "next/link";

import { saveQuizProfile } from "@/app/actions/account";
import { PerfumeImage } from "@/app/perfumes/PerfumeImage";
import { genderLabel } from "@/app/perfumes/types";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { answersFromSearchParams, answersToFields, answersToSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { type QuizAnswers } from "@/lib/quiz/questions";
import { summarizeAnswers } from "@/lib/quiz/summary";
import { AffinityRing } from "@/components/AffinityRing";
import { AnalyzingLoader } from "@/components/AnalyzingLoader";
import { getFavoriteLabels, QUIZ_GENDERS, recommendFromAnswers, type QuizGender } from "@/lib/quiz/recommend";
import type { PreferenceKey } from "@/lib/quiz/preferences";

export const metadata = { title: "Tus recomendaciones" };

const RESULT_LIMIT = 12;

const PREFERENCE_LABELS: Record<PreferenceKey, string> = {
  season: "estación",
  occasion: "momento del día",
  duration: "duración",
  sillage: "estela",
};

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

  // Para el filtro de género se reenvían las mismas respuestas como campos ocultos.
  const hiddenFields = answersToFields(validated.answers);
  const favorites = await getFavoriteLabels(validated.answers.favoritos);

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

      <section className="quiz-summary" aria-labelledby="quiz-summary-title">
        <div className="quiz-summary-head">
          <h2 id="quiz-summary-title">Tu perfil olfativo</h2>
          <Link className="quiz-summary-edit" href={`/quiz?${answersToSearchParams(validated.answers).toString()}`}>
            Editar respuestas
          </Link>
        </div>
        <dl className="quiz-summary-list">
          {summarizeAnswers(validated.answers, favorites.map((f) => f.label)).map((row) => (
            <div key={row.id}>
              <dt>{row.title}</dt>
              <dd>
                {row.labels.length === 0 ? (
                  <span className="quiz-summary-none">Ninguna</span>
                ) : (
                  <ul className="perfume-badges" aria-label={row.title}>
                    {row.labels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="quiz-summary-actions">
          <form className="quiz-gender" action="/quiz/resultado" method="GET">
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
            <button type="submit">Aplicar</button>
          </form>
          <Suspense fallback={null}>
            <SaveProfile hiddenFields={hiddenFields} gender={gender} />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<AnalyzingLoader />}>
        <Results answers={validated.answers} gender={gender} />
      </Suspense>
    </main>
  );
}

type Field = { name: string; value: string };

// "Guardar este perfil" depende de la sesión: se resuelve aparte para no frenar el resto de la página.
async function SaveProfile({ hiddenFields, gender }: { hiddenFields: Field[]; gender?: QuizGender }) {
  const userId = await getSessionDbUserId();
  return userId ? (
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
  );
}

// El cálculo es lo más lento de la página: llega por streaming mientras se muestra el indicador de análisis.
async function Results({ answers, gender }: { answers: QuizAnswers; gender?: QuizGender }) {
  const userId = await getSessionDbUserId();
  const results = await recommendFromAnswers(answers, { gender, limit: RESULT_LIMIT, userId });

  if (results.length === 0) {
    return (
      <section className="catalog-empty">
        <p className="catalog-empty-title">No encontramos perfumes para este perfil.</p>
        <p>Probá quitar algún rechazo o cambiar el filtro de género.</p>
      </section>
    );
  }

  return (
    <>
      <p className="catalog-count">{results.length} recomendaciones</p>
      <ul className="catalog-grid">
        {results.map((result, index) => (
          <li key={result.perfumeId} style={{ "--i": index } as React.CSSProperties}>
          <article className="perfume-card">
            <PerfumeImage
              name={result.name}
              brand={result.brand}
              imageUrl={result.imageUrl}
              accords={result.matchedAccords.map((name, i) => ({ intensity: 100 - i, accord: { name } }))}
            />
            <AffinityRing percent={Math.round(result.score * 100)} index={index} />
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
              {result.matchedPreferences.length > 0 && (
                <p className="quiz-reason">Coincide con lo que pediste: {result.matchedPreferences.map((key) => PREFERENCE_LABELS[key]).join(", ")}.</p>
              )}
            </div>
          </article>
          </li>
        ))}
      </ul>
    </>
  );
}
