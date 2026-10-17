"use client";

import { useEffect, useRef, useState } from "react";

import { FavoritesPicker, type FavoritePerfume } from "./FavoritesPicker";

type Option = { id: string; label: string };
export type WizardQuestion = { id: string; label: string; kind: "single" | "multi"; options: Option[]; defaultOptionId?: string };
export type WizardAnswers = Record<string, string | string[]>;

const AUTO_ADVANCE_MS = 260;

// Quiz paso a paso: una pregunta por pantalla, con barra de progreso, tarjetas de opción y transición entre pasos.
// Sigue siendo un formulario GET normal (los inputs conservan su `name`): sin JavaScript se ven todas las preguntas
// juntas (ver `@media (scripting: none)` en globals.css) y se envía igual a /quiz/resultado, que valida las respuestas en el servidor.
//
// Después de las preguntas hay un paso opcional ("perfumes que ya amás", hasta `maxFavorites`) que usa JavaScript.
export function QuizWizard({
  questions,
  saved,
  savedFavorites,
  maxFavorites,
}: {
  questions: WizardQuestion[];
  saved: WizardAnswers | null;
  savedFavorites: FavoritePerfume[];
  maxFavorites: number;
}) {
  const favoritesStep = questions.length;
  const total = questions.length + 1;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(() =>
    Object.fromEntries(questions.map((q) => [q.id, saved?.[q.id] ?? q.defaultOptionId ?? (q.kind === "multi" ? [] : "")])),
  );
  const legendRef = useRef<HTMLLegendElement | null>(null);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAnswered = (q: WizardQuestion) => q.kind === "multi" || Boolean(answers[q.id]);
  const allAnswered = questions.every(isAnswered);
  const last = step === total - 1;

  // Al cambiar de paso (no al cargar) el foco va a la pregunta: lo anuncian los lectores de pantalla y sigue el teclado.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    legendRef.current?.focus();
  }, [step]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const stepAnswered = step === favoritesStep || isAnswered(questions[step]);

  const go = (next: number) => setStep(Math.max(0, Math.min(total - 1, next)));

  const choose = (q: WizardQuestion, optionId: string) => {
    if (q.kind === "single") {
      setAnswers((a) => ({ ...a, [q.id]: optionId }));
      // En las preguntas de una sola opción se avanza solo, con una pausa breve para ver la elección.
      if (timer.current) clearTimeout(timer.current);
      if (step < total - 1) timer.current = setTimeout(() => go(step + 1), AUTO_ADVANCE_MS);
    } else {
      setAnswers((a) => {
        const current = (a[q.id] as string[]) ?? [];
        return { ...a, [q.id]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
      });
    }
  };

  return (
    <form className="quiz-wizard" action="/quiz/resultado" method="GET">
      <div className="quiz-progress">
        <div
          className="quiz-progress-bar"
          role="progressbar"
          aria-label="Progreso del quiz"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
          aria-valuetext={`Pregunta ${step + 1} de ${total}`}
        >
          <span style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <p className="quiz-progress-text" aria-hidden="true">
          Pregunta {step + 1} de {total}
        </p>
      </div>

      {questions.map((q, index) => (
        <fieldset key={q.id} className="quiz-step" hidden={index !== step} data-active={index === step}>
          <legend ref={index === step ? legendRef : undefined} tabIndex={-1}>
            {q.label}
          </legend>
          {q.kind === "multi" && <p className="quiz-hint">Podés elegir varias, o ninguna.</p>}
          <div className="quiz-cards">
            {q.options.map((option) => {
              const checked = q.kind === "single" ? answers[q.id] === option.id : (answers[q.id] as string[]).includes(option.id);
              return (
                <label key={option.id} className={`quiz-card quiz-card-${q.kind}`} data-checked={checked}>
                  <input
                    className="sr-only"
                    type={q.kind === "single" ? "radio" : "checkbox"}
                    name={q.id}
                    value={option.id}
                    checked={checked}
                    onChange={() => choose(q, option.id)}
                  />
                  <span className="quiz-card-mark" aria-hidden="true" />
                  <span className="quiz-card-label">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="quiz-step quiz-favorites-step" hidden={favoritesStep !== step} data-active={favoritesStep === step}>
        <legend ref={favoritesStep === step ? legendRef : undefined} tabIndex={-1}>
          ¿Hay perfumes que ya amás?
        </legend>
        <p className="quiz-hint">Es opcional. Elegí hasta {maxFavorites} y buscamos otros con acordes parecidos.</p>
        <FavoritesPicker initial={savedFavorites} max={maxFavorites} />
      </fieldset>

      <div className="quiz-wizard-nav">
        <button type="button" className="quiz-nav-back" onClick={() => go(step - 1)} disabled={step === 0}>
          ← Anterior
        </button>
        {last ? (
          // `key` distinto: si React reutilizara el mismo <button> y le cambiara el type a "submit" durante el clic,
          // el navegador enviaría el formulario con el clic que solo quería pasar de pregunta.
          <button
            key="submit"
            type="submit"
            className="button"
            aria-disabled={!allAnswered}
            aria-describedby={!allAnswered ? "quiz-next-help" : undefined}
            onClick={(event) => {
              if (!allAnswered) event.preventDefault();
            }}
          >
            Ver mis recomendaciones
          </button>
        ) : (
          <button
            key="next"
            type="button"
            className="button"
            aria-disabled={!stepAnswered}
            aria-describedby={!stepAnswered ? "quiz-next-help" : undefined}
            onClick={() => {
              if (stepAnswered) go(step + 1);
            }}
          >
            Siguiente →
          </button>
        )}
      </div>
      {(last ? !allAnswered : !stepAnswered) && (
        <p className="quiz-hint quiz-next-help" id="quiz-next-help">
          {last && stepAnswered
            ? "Te faltan respuestas: volvé con “Anterior” y completá las preguntas de una sola opción."
            : "Elegí una opción para seguir"}
        </p>
      )}

      <div className="quiz-submit-fallback">
        <button type="submit" className="button">
          Ver mis recomendaciones
        </button>
      </div>
    </form>
  );
}
