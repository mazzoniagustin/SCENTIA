// Indicador mientras se calculan las recomendaciones del quiz: anillo que gira y mensajes que van rotando (CSS puro).
export function AnalyzingLoader() {
  return (
    <section className="analyzing" role="status" aria-live="polite">
      <div className="analyzing-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="analyzing-title">Analizando tu perfil olfativo</p>
      <p className="analyzing-steps" aria-hidden="true">
        <span>Leyendo tus respuestas…</span>
        <span>Buscando entre miles de perfumes…</span>
        <span>Ordenando por afinidad…</span>
      </p>
      <span className="sr-only">Calculando tus recomendaciones, un momento.</span>
    </section>
  );
}
