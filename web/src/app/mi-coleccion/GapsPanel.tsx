'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { Finding, GapsResponse } from '@/lib/gaps/response';
import type { GenderFilter } from '@/lib/gaps/gender';
import { announcementFor, familyColor, genderHint, groupFindings, valueColor, viewFromResponse, type GapsView, type RefinedList } from '@/lib/gaps/view';
import { HorizontalScroller } from '@/components/HorizontalScroller';
import { DistributionList } from './Distribution';
import { Headline } from './Headline';
import { RefineBox } from './RefineBox';
import { Reveal } from './reveal';
import { SuggestionCard } from './SuggestionCard';

function FindingList({ items }: { items: Finding[] }) {
  return (
    <Reveal as="ul" className="gaps-findings" threshold={0.15}>
      {items.map((f, i) => (
        <li key={`${f.area}-${f.code}`} style={{ '--k': i } as CSSProperties}>
          <p className="gaps-finding-label">{f.label}</p>
          <p>{f.text}</p>
        </li>
      ))}
    </Reveal>
  );
}

// Selector de género de las sugerencias: lo deducido de la colección viene marcado, y la persona lo puede cambiar.
function GenderPicker({ gender, busy, onPick }: { gender: GapsResponse['gender']; busy: boolean; onPick: (value: GenderFilter) => void }) {
  return (
    <div className="gaps-gender" role="group" aria-labelledby="gaps-gender-title">
      <p id="gaps-gender-title" className="gaps-gender-title">
        Género de las sugerencias
      </p>
      <div className="gaps-gender-chips">
        {gender.options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="gaps-gender-chip"
            aria-pressed={gender.applied === o.value}
            disabled={busy}
            onClick={() => onPick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="form-hint" aria-live="polite">
        {genderHint(gender)}
      </p>
    </div>
  );
}

function Suggestions({
  data,
  refined,
  refreshing,
  refreshNote,
  onPickGender,
  onRefined,
  onClearRefined,
}: {
  data: GapsResponse;
  refined: RefinedList | null;
  refreshing: boolean;
  refreshNote: string | null;
  onPickGender: (value: GenderFilter) => void;
  onRefined: (refined: RefinedList) => void;
  onClearRefined: () => void;
}) {
  // Afinadas con IA o las del análisis: el rollo es el mismo.
  const suggestions = refined ? refined.suggestions : data.suggestions;
  const complete = refined ? refined.complete : data.complete;
  return (
    <section className="gaps-block" aria-labelledby="gaps-sugg-title">
      <h3 id="gaps-sugg-title" className="outfit-subtitle">
        Perfumes para explorar
      </h3>
      <GenderPicker gender={data.gender} busy={refreshing} onPick={onPickGender} />
      {refreshNote && (
        <p className="notice" role="status">
          {refreshNote}
        </p>
      )}
      {refined && (
        <div className="gaps-refined-note">
          <p>
            {refined.summary}
          </p>
          <button type="button" className="gaps-link-button" onClick={onClearRefined}>
            Volver a las sugerencias del análisis
          </button>
        </div>
      )}
      {suggestions.length === 0 ? (
        <p className="form-hint">
          {refined && !refined.hadCriteria
            ? 'No encontramos ese perfume en el catálogo. Probá con otro nombre o contá el estilo que buscás.'
            : 'Por ahora no encontramos perfumes del catálogo para sugerirte con ese género.'}
        </p>
      ) : (
        <>
          {!refined && <p className="form-hint">Para empezar por ahí, estos perfumes del catálogo van en esa dirección.</p>}
          {!complete && <p className="notice">La lista es corta: no hay muchos perfumes que encajen con lo que pediste.</p>}
          {/* Rollo: avanza solo y despacio, se frena al pasar el mouse o con el foco, y se puede arrastrar o usar las flechas.
              Las tarjetas entran una tras otra cuando el rollo aparece en pantalla (no antes). */}
          <Reveal key={`${data.gender.applied}-${refined ? refined.summary : 'base'}`} className={refreshing ? 'gaps-reel-wrap is-refreshing' : 'gaps-reel-wrap'} threshold={0.35}>
            <HorizontalScroller label="Perfumes para explorar" autoAdvanceMs={5000} className="gaps-reel">
              <ul className="scroller-track gaps-suggestions">
                {suggestions.map((s, i) => (
                  <SuggestionCard key={s.perfumeId} s={s} index={i} />
                ))}
              </ul>
            </HorizontalScroller>
          </Reveal>
        </>
      )}
      {data.refine.enabled && <RefineBox maxChars={data.refine.maxChars} gender={data.gender.applied} onRefined={onRefined} />}
    </section>
  );
}

// Lo que se ve al tocar "Mostrar más": el detalle de lo que encontramos y cómo se reparte la colección. Cada bloque entra con
// un pequeño retraso escalonado (`--i`).
function MoreDetails({ data }: { data: GapsResponse }) {
  const groups = groupFindings(data.findings);
  const hasFindings = data.findings.length > 0;

  return (
    <>
      {hasFindings && (
        <Reveal as="section" className="gaps-block" aria-labelledby="gaps-findings-title" threshold={0.1}>
          <h3 id="gaps-findings-title" className="outfit-subtitle">
            Lo que encontramos
          </h3>

          {groups.gap.length > 0 && (
            <section className="gaps-group" aria-labelledby="gaps-gap-title">
              <h4 id="gaps-gap-title" className="gaps-group-title">
                Huecos
              </h4>
              <p className="form-hint">Lo que no aparece en tu colección.</p>
              <FindingList items={groups.gap} />
            </section>
          )}

          {groups.weak.length > 0 && (
            <section className="gaps-group" aria-labelledby="gaps-weak-title">
              <h4 id="gaps-weak-title" className="gaps-group-title">
                Con poca presencia
              </h4>
              <p className="form-hint">Lo tenés, pero con poco peso en tu colección.</p>
              <FindingList items={groups.weak} />
            </section>
          )}

          {groups.unexplored.length > 0 && (
            <section className="gaps-group gaps-group-neutral" aria-labelledby="gaps-unexplored-title">
              <h4 id="gaps-unexplored-title" className="gaps-group-title">
                Todavía no exploraste
              </h4>
              <p className="form-hint">Rincones menos comunes. Es solo para curiosear: no hace falta cubrirlos.</p>
              <FindingList items={groups.unexplored} />
            </section>
          )}
        </Reveal>
      )}

      <Reveal as="section" className="gaps-block" aria-labelledby="gaps-dist-title" threshold={0.05}>
        <h3 id="gaps-dist-title" className="outfit-subtitle">
          Cómo se reparte tu colección
        </h3>
        <p className="form-hint">
          Sobre {data.coverage.used} {data.coverage.used === 1 ? 'perfume analizado' : 'perfumes analizados'}. Un perfume puede estar en más de un grupo.
        </p>

        {data.families.length > 0 && (
          <section className="gaps-group" aria-labelledby="gaps-families-title">
            <h4 id="gaps-families-title" className="gaps-group-title">
              Familias olfativas
            </h4>
            <DistributionList rows={data.families} caption="Familias olfativas" base={data.coverage.used} colorOf={familyColor} />
          </section>
        )}

        {data.dimensions.map((d) => (
          <section key={d.dimension} className="gaps-group" aria-labelledby={`gaps-dim-${d.dimension}`}>
            <h4 id={`gaps-dim-${d.dimension}`} className="gaps-group-title">
              {d.label}
              {d.informational && <span className="outfit-chip gaps-tag">Solo informativo</span>}
            </h4>
            {d.status === 'insufficient_data' ? (
              <p className="form-hint">No hay datos suficientes en tus perfumes para mostrar esta dimensión.</p>
            ) : (
              <DistributionList rows={d.rows} caption={d.label} base={d.withData} colorOf={(code) => valueColor(d.dimension, code)} />
            )}
          </section>
        ))}
      </Reveal>

      {data.notes.length > 0 && (
        <Reveal as="section" className="gaps-block" aria-labelledby="gaps-notes-title" threshold={0.2}>
          <h3 id="gaps-notes-title" className="outfit-subtitle">
            Para leer con contexto
          </h3>
          <ul className="gaps-notes">
            {data.notes.map((n) => (
              <li key={n} className="form-hint">
                {n}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </>
  );
}

function Results({
  data,
  refreshing,
  refreshNote,
  onPickGender,
}: {
  data: GapsResponse;
  refreshing: boolean;
  refreshNote: string | null;
  onPickGender: (value: GenderFilter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Sugerencias afinadas con el texto de la persona (null: las del análisis). Cambiar el género trae datos nuevos y las descarta.
  const [refined, setRefined] = useState<RefinedList | null>(null);
  const [seenGender, setSeenGender] = useState(data.gender.applied);
  if (seenGender !== data.gender.applied) {
    setSeenGender(data.gender.applied);
    setRefined(null);
  }
  // Cuántas veces se abrió el detalle: cada apertura monta el detalle de nuevo, así las barras y los números vuelven a llenarse.
  const [opens, setOpens] = useState(0);

  function toggle() {
    if (!expanded) setOpens((n) => n + 1);
    setExpanded(!expanded);
  }

  return (
    <>
      {data.headline && <Headline text={data.headline} />}

      <Suggestions
        data={data}
        refined={refined}
        refreshing={refreshing}
        refreshNote={refreshNote}
        onPickGender={onPickGender}
        onRefined={setRefined}
        onClearRefined={() => setRefined(null)}
      />

      <div className="gaps-more-toggle">
        <button
          type="button"
          className="button button-ghost gaps-more-button"
          aria-expanded={expanded}
          aria-controls="gaps-more"
          onClick={toggle}
        >
          {expanded ? 'Mostrar menos' : 'Mostrar más'}
          <svg className="gaps-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="M3.5 6 8 10.5 12.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="form-hint">Familias olfativas, estación, día/noche, duración y estela.</p>
      </div>

      {/* Colapsado queda oculto para el teclado y los lectores de pantalla (visibility), y se abre con una transición de altura. */}
      <div id="gaps-more" className="gaps-more" data-open={expanded}>
        <div className="gaps-more-inner">
          {opens > 0 && <MoreDetails key={opens} data={data} />}
        </div>
      </div>
    </>
  );
}

export function GapsPanel() {
  const [view, setView] = useState<GapsView>({ kind: 'idle' });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const busy = view.kind === 'loading';
  const waiting = view.kind === 'rate_limited' && view.seconds > 0;

  // Al llegar un resultado o un aviso, el foco pasa a su encabezado.
  useEffect(() => {
    if (view.kind !== 'idle' && !busy) headingRef.current?.focus();
  }, [view.kind, busy]);

  // Cuenta regresiva del Retry-After: el botón queda deshabilitado hasta que llega a 0.
  useEffect(() => {
    if (view.kind !== 'rate_limited' || view.seconds <= 0) return;
    const timer = window.setTimeout(() => setView({ kind: 'rate_limited', seconds: view.seconds - 1 }), 1000);
    return () => window.clearTimeout(timer);
  }, [view]);

  async function request(gender?: GenderFilter): Promise<GapsView> {
    try {
      const res = await fetch('/api/collection/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gender ? { gender } : {}),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return viewFromResponse(res.status, res.headers.get('Retry-After'), body);
    } catch {
      return { kind: 'network' };
    }
  }

  async function analyze() {
    setRefreshNote(null);
    setView({ kind: 'loading' });
    setView(await request());
  }

  // Cambiar el género vuelve a pedir el análisis, pero deja a la vista el resultado anterior (no lo reemplaza por el cargando).
  async function pickGender(gender: GenderFilter) {
    if (view.kind !== 'ok' || view.data.gender.applied === gender) return;
    setRefreshing(true);
    setRefreshNote(null);
    const next = await request(gender);
    if (next.kind === 'ok') setView(next);
    else if (next.kind === 'unauthorized') setView(next);
    else setRefreshNote(next.kind === 'rate_limited' ? 'Hiciste muchas consultas seguidas: esperá unos segundos y probá de nuevo.' : 'No pudimos actualizar las sugerencias. Probá de nuevo.');
    setRefreshing(false);
  }

  return (
    <section className="gaps" aria-labelledby="gaps-title">
      <h2 id="gaps-title" className="outfit-section-title">
        ¿Qué le falta a tu colección?
      </h2>
      <div className="outfit-actions">
        <button type="button" className="button" onClick={analyze} disabled={busy || waiting} aria-busy={busy}>
          {busy ? 'Analizando…' : 'Ver qué le falta a mi colección'}
        </button>
      </div>
      <p className="form-hint gaps-privacy">
        Se analiza solo lo que ya tenés guardado. Nada de tus notas ni de tus puntajes sale del servidor, y por ahora no usamos IA.
      </p>

      <noscript>
        <p className="notice">Esta función necesita JavaScript. Activalo en tu navegador para ver el análisis.</p>
      </noscript>

      <div role="status" aria-live="polite" className="sr-only">
        {announcementFor(view)}
      </div>

      <div className="gaps-result" aria-busy={busy}>
        {busy && (
          <>
            <p className="outfit-loading">Analizando tu colección…</p>
            <div className="gaps-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )}

        {view.kind === 'ok' && (
          <>
            <h3 ref={headingRef} tabIndex={-1} className="outfit-section-title gaps-result-title">
              Lo que vimos en tu colección
            </h3>
            <Results data={view.data} refreshing={refreshing} refreshNote={refreshNote} onPickGender={pickGender} />
          </>
        )}

        {view.kind === 'guide' && view.data.guide && (
          <div className="catalog-empty">
            <h3 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              {view.data.guide.title}
            </h3>
            <p>{view.data.guide.text}</p>
            {view.data.guide.links.length > 0 && (
              <ul className="gaps-links">
                {view.data.guide.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view.kind === 'unauthorized' && (
          <div className="catalog-empty">
            <h3 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Tu sesión venció
            </h3>
            <p>
              <Link href="/login">Ingresá de nuevo</Link> para ver el análisis.
            </p>
          </div>
        )}

        {view.kind === 'rate_limited' && (
          <div className="catalog-empty">
            <h3 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Esperá unos segundos
            </h3>
            <p>
              Hiciste muchas consultas seguidas
              {view.seconds > 0 ? `; podés probar de nuevo en ${view.seconds} ${view.seconds === 1 ? 'segundo' : 'segundos'}.` : '.'}
            </p>
            <button type="button" className="button" onClick={analyze} disabled={waiting}>
              Reintentar
            </button>
          </div>
        )}

        {(view.kind === 'error' || view.kind === 'network') && (
          <div className="catalog-empty">
            <h3 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              {view.kind === 'network' ? 'No pudimos conectarnos' : 'Algo salió mal'}
            </h3>
            <p>
              {view.kind === 'network'
                ? 'Parece que no hay conexión. Revisala y probá de nuevo.'
                : 'No pudimos armar el análisis de tu colección. Probá de nuevo.'}
            </p>
            <button type="button" className="button" onClick={analyze}>
              Reintentar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
