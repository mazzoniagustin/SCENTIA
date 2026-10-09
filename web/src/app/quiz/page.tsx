import Link from "next/link";

import { getUserProfile } from "@/lib/account/data";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { answersToSearchParams } from "@/lib/quiz/params";
import { QUESTIONS } from "@/lib/quiz/questions";
import { QuizWizard } from "./QuizWizard";

export const metadata = { title: "Quiz de perfil olfativo" };

// Quiz paso a paso (QuizWizard) sobre un formulario GET: sin JavaScript también funciona. Las respuestas viajan en la URL
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

      <QuizWizard
        questions={QUESTIONS.map((q) => ({ id: q.id, label: q.label, kind: q.kind, options: q.options.map((o) => ({ id: o.id, label: o.label })) }))}
        saved={saved}
      />
    </main>
  );
}
