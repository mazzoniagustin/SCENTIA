import Link from "next/link";

import { getUserProfile } from "@/lib/account/data";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { answersToSearchParams } from "@/lib/quiz/params";
import { QUESTIONS } from "@/lib/quiz/questions";

export const metadata = { title: "Quiz de perfil olfativo" };

// Formulario HTML nativo (GET): funciona sin JavaScript. Las respuestas viajan en la URL
// hacia /quiz/resultado, que las valida en el servidor.
export default async function QuizPage() {
  // Con sesión y un perfil guardado vigente, se precarga el formulario y se ofrece verlo directo.
  const user = await getAuthenticatedUserOrNull();
  const saved = user ? (await getUserProfile(user.id))?.answers ?? null : null;

  return (
    <main id="contenido" className="catalog">
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

      {saved && (
        <p className="notice" role="status">
          Tenés un perfil guardado.{" "}
          <Link href={`/quiz/resultado?${answersToSearchParams(saved).toString()}`}>Ver mis recomendaciones</Link> o
          cambiá tus respuestas y volvé a enviar.
        </p>
      )}

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
                    defaultChecked={
                      saved
                        ? question.kind === "single"
                          ? saved[question.id] === option.id
                          : (saved[question.id] as string[]).includes(option.id)
                        : false
                    }
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
