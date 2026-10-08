import Link from "next/link";

import { QUESTIONS } from "@/lib/quiz/questions";

export const metadata = { title: "Quiz de perfil olfativo" };

// Formulario HTML nativo (GET): funciona sin JavaScript. Las respuestas viajan en la URL
// hacia /quiz/resultado, que las valida en el servidor.
export default function QuizPage() {
  return (
    <main className="catalog">
      <Link className="back-link" href="/">
        ← Inicio
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Quiz</p>
        <h1>Tu perfil olfativo</h1>
        <p className="lead">
          Respondé unas preguntas y te recomendamos perfumes según los acordes que
          más te gustan. Dura unos dos minutos.
        </p>
      </header>

      <form className="quiz-form" action="/quiz/resultado" method="GET">
        {QUESTIONS.map((question) => (
          <fieldset key={question.id} className="quiz-question">
            <legend>{question.label}</legend>
            <div className="quiz-options">
              {question.options.map((option, index) => (
                <label key={option.id} className="quiz-option">
                  <input
                    type={question.kind === "single" ? "radio" : "checkbox"}
                    name={question.id}
                    value={option.id}
                    required={question.kind === "single" && index === 0}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="button" type="submit">
          Ver mis recomendaciones
        </button>
      </form>
    </main>
  );
}
