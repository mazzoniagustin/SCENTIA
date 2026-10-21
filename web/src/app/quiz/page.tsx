import Link from "next/link";

import { getUserProfile } from "@/lib/account/data";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { answersFromSearchParams, answersToSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { MAX_FAVORITES, QUESTIONS } from "@/lib/quiz/questions";
import { getFavoriteLabels } from "@/lib/quiz/recommend";
import { QuizWizard } from "./QuizWizard";

export const metadata = { title: "Quiz de perfil olfativo" };

// Quiz paso a paso (QuizWizard) sobre un formulario GET: sin JavaScript también funciona. Las respuestas viajan en la URL
// hacia /quiz/resultado, que las valida en el servidor.
export default async function QuizPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // Respuestas en la URL (viene de "Editar respuestas" en los resultados): se precargan y mandan sobre el perfil guardado.
  const fromUrl = validateAnswers(answersFromSearchParams(await searchParams));
  // Con sesión y un perfil guardado vigente, se precarga el formulario y se ofrece verlo directo.
  const user = await getAuthenticatedUserOrNull();
  const saved = user ? (await getUserProfile(user.id))?.answers ?? null : null;
  const initial = fromUrl.ok ? fromUrl.answers : saved;
  const savedFavorites = await getFavoriteLabels(initial?.favoritos ?? []);

  return (
    <main id="contenido" className="catalog">
      <Link className="back-link" href="/">
        ← Inicio
      </Link>
      <header className="catalog-header">
        <h1>Tu perfil olfativo</h1>
        <p className="lead">
          Respondé unas preguntas y te recomendamos perfumes según los acordes que
          más te gustan. Dura unos dos minutos.
        </p>
      </header>

      {saved && !fromUrl.ok && (
        <p className="notice" role="status">
          Tenés un perfil guardado.{" "}
          <Link href={`/quiz/resultado?${answersToSearchParams(saved).toString()}`}>Ver mis recomendaciones</Link> o
          cambiá tus respuestas y volvé a enviar.
        </p>
      )}

      <QuizWizard
        questions={QUESTIONS.map((q) => ({ id: q.id, label: q.label, kind: q.kind, options: q.options.map((o) => ({ id: o.id, label: o.label })), defaultOptionId: q.defaultOptionId }))}
        saved={initial}
        savedFavorites={savedFavorites}
        maxFavorites={MAX_FAVORITES}
      />
    </main>
  );
}
