'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { PerfumeImage } from '../perfumes/PerfumeImage';

type Pick = {
  perfumeId: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  status: 'OWNED' | 'SAMPLED';
  topAccords: string[];
  reasons: string[];
  score: number;
};

type Weather = {
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  precipitationMm: number;
  isDay: boolean;
  band: 'cold' | 'mild' | 'hot';
  wet: boolean;
  humid: boolean;
};

type Place = { label: string; latitude: number; longitude: number };
type Coords = { latitude: number; longitude: number };

type View =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'loading' }
  | { kind: 'denied'; reason: 'denied' | 'unsupported' | 'unavailable' }
  | { kind: 'ok'; weather: Weather; primary: Pick; alternatives: Pick[]; phrase: { text: string; source: string } }
  | { kind: 'empty_collection' | 'no_wearable' | 'no_accords'; weather: Weather }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited'; seconds: number }
  | { kind: 'weather_unavailable' }
  | { kind: 'error' };

const REASON_LABELS: Record<string, string> = {
  fresh_for_heat: 'Fresco para el calor',
  warm_for_cold: 'Abrigado para el frío',
  light_for_humidity: 'Liviano con la humedad',
  avoids_cloying: 'Sin notas empalagosas',
  owned: 'Lo tenés en tu colección',
};

const STATUS_LABELS = { OWNED: 'Lo tengo', SAMPLED: 'Probado' } as const;

// Redondea a 1 decimal (~10 km) ANTES de que la ubicación salga del navegador.
const round1 = (value: number) => Math.round(value * 10) / 10;

function describeWeather(w: Weather) {
  const feel = w.band === 'cold' ? 'hace frío' : w.band === 'hot' ? 'hace calor' : 'está templado';
  return [
    { label: 'Temperatura', value: `${Math.round(w.temperatureC)} °C (${feel})` },
    { label: 'Sensación térmica', value: `${Math.round(w.apparentTemperatureC)} °C` },
    { label: 'Humedad', value: `${Math.round(w.humidityPct)} %${w.humid ? ' (ambiente húmedo)' : ''}` },
    { label: 'Lluvia', value: w.wet ? 'Sí, está lloviendo' : 'No, sin lluvia' },
    { label: 'Momento', value: w.isDay ? 'De día' : 'De noche' },
  ];
}

function announcement(view: View): string {
  switch (view.kind) {
    case 'locating':
      return 'Pidiendo tu ubicación.';
    case 'loading':
      return 'Consultando el clima y armando tu recomendación.';
    case 'ok':
      return `Listo: te recomendamos ${view.primary.brand} ${view.primary.name}.`;
    case 'empty_collection':
      return 'Tu colección está vacía.';
    case 'no_wearable':
      return 'No hay perfumes elegibles en tu colección.';
    case 'no_accords':
      return 'A los perfumes de tu colección les faltan datos de acordes.';
    case 'denied':
      return 'No pudimos usar tu ubicación. Podés buscar una ciudad.';
    case 'unauthorized':
      return 'Tu sesión venció. Volvé a ingresar.';
    case 'rate_limited':
      return `Esperá unos segundos${view.seconds > 0 ? ` (${view.seconds})` : ''} y probá de nuevo.`;
    case 'weather_unavailable':
      return 'No pudimos consultar el clima ahora.';
    case 'error':
      return 'Algo salió mal. Probá de nuevo.';
    default:
      return '';
  }
}

function CompactCard({ pick }: { pick: Pick }) {
  return (
    <li className="outfit-alt">
      <Link href={`/perfumes/${pick.perfumeId}`} className="outfit-alt-link">
        <span className="outfit-alt-media">
          <PerfumeImage name={pick.name} brand={pick.brand} imageUrl={pick.imageUrl} size="thumb" />
        </span>
        <span className="outfit-alt-text">
          <span className="perfume-brand">{pick.brand}</span>
          <span className="outfit-alt-name">{pick.name}</span>
          <span className="outfit-chip">{STATUS_LABELS[pick.status]}</span>
        </span>
      </Link>
    </li>
  );
}

export function OutfitToday() {
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [showPlaces, setShowPlaces] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Solo en memoria (nunca en storage, cookies ni URL) para poder reintentar; se pierde al salir de la página.
  const lastCoords = useRef<Coords | null>(null);

  const busy = view.kind === 'locating' || view.kind === 'loading';

  // Al llegar un resultado o un aviso, el foco pasa a su encabezado.
  useEffect(() => {
    if (view.kind !== 'idle' && !busy) headingRef.current?.focus();
  }, [view, busy]);

  async function fetchOutfit(coords: Coords) {
    lastCoords.current = coords;
    setView({ kind: 'loading' });
    try {
      const res = await fetch('/api/outfit/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      });
      if (res.status === 401) return setView({ kind: 'unauthorized' });
      if (res.status === 429) {
        const seconds = Number.parseInt(res.headers.get('Retry-After') ?? '', 10);
        return setView({ kind: 'rate_limited', seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 });
      }
      if (res.status === 502) return setView({ kind: 'weather_unavailable' });
      if (!res.ok) return setView({ kind: 'error' });
      const data = await res.json();
      if (data.status === 'ok') {
        return setView({ kind: 'ok', weather: data.weather, primary: data.primary, alternatives: data.alternatives ?? [], phrase: data.phrase });
      }
      if (data.status === 'empty_collection' || data.status === 'no_wearable' || data.status === 'no_accords') {
        return setView({ kind: data.status, weather: data.weather });
      }
      setView({ kind: 'error' });
    } catch {
      setView({ kind: 'error' });
    }
  }

  function requestLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setShowPlaces(true);
      return setView({ kind: 'denied', reason: 'unsupported' });
    }
    setView({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void fetchOutfit({ latitude: round1(pos.coords.latitude), longitude: round1(pos.coords.longitude) });
      },
      (err) => {
        setShowPlaces(true);
        setView({ kind: 'denied', reason: err.code === 1 ? 'denied' : 'unavailable' });
      },
      { timeout: 10_000, maximumAge: 0, enableHighAccuracy: false },
    );
  }

  async function searchPlaces(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setPlaceError('Escribí al menos 2 letras.');
      return;
    }
    setPlaceError('');
    setSearching(true);
    setPlaces(null);
    try {
      const res = await fetch('/api/outfit/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (res.status === 401) return setView({ kind: 'unauthorized' });
      if (res.status === 429) return setPlaceError('Esperá unos segundos y probá de nuevo.');
      if (!res.ok) return setPlaceError('No pudimos buscar ciudades ahora. Probá de nuevo.');
      const data = await res.json();
      const found: Place[] = Array.isArray(data.places) ? data.places : [];
      setPlaces(found);
    } catch {
      setPlaceError('No pudimos buscar ciudades ahora. Probá de nuevo.');
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(place: Place) {
    void fetchOutfit({ latitude: round1(place.latitude), longitude: round1(place.longitude) });
  }

  function retry() {
    if (lastCoords.current) void fetchOutfit(lastCoords.current);
    else requestLocation();
  }

  return (
    <div className="outfit-body">
      <section className="outfit-start" aria-labelledby="outfit-start-title">
        <h2 id="outfit-start-title" className="outfit-section-title">
          Tu ubicación
        </h2>
        <div className="outfit-actions">
          <button type="button" className="button" onClick={requestLocation} disabled={busy} aria-busy={busy}>
            Usar mi ubicación
          </button>
          {!showPlaces && (
            <button type="button" className="button button-ghost" onClick={() => setShowPlaces(true)} disabled={busy}>
              Prefiero buscar una ciudad
            </button>
          )}
        </div>
        <p className="form-hint outfit-privacy">
          Usamos tu ubicación solo para consultar el clima. Se redondea a unos 10 km antes de salir de tu navegador, no se guarda ni se registra.
          Esa ubicación aproximada se envía a Open-Meteo.
        </p>

        {showPlaces && (
          <form className="outfit-places auth-form" onSubmit={searchPlaces} noValidate>
            {view.kind === 'denied' && (
              <p className="notice" role="note">
                {view.reason === 'denied'
                  ? 'No nos diste acceso a tu ubicación, y está bien. Podés buscar tu ciudad a mano.'
                  : view.reason === 'unsupported'
                    ? 'Tu navegador no permite pedir la ubicación. Podés buscar tu ciudad a mano.'
                    : 'No pudimos obtener tu ubicación. Podés buscar tu ciudad a mano.'}
              </p>
            )}
            <label htmlFor="outfit-city">Ciudad</label>
            <div className="outfit-places-row">
              <input
                id="outfit-city"
                name="city"
                type="text"
                autoComplete="off"
                maxLength={80}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-invalid={placeError ? true : undefined}
                aria-describedby={placeError ? 'outfit-city-error' : undefined}
              />
              <button type="submit" disabled={searching || busy}>
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {placeError && (
              <p id="outfit-city-error" className="form-message form-message-error">
                {placeError}
              </p>
            )}
            {places && places.length === 0 && <p className="form-hint">No encontramos esa ciudad. Probá con otro nombre.</p>}
            {places && places.length > 0 && (
              <ul className="outfit-place-list" aria-label="Resultados de la búsqueda">
                {places.map((place) => (
                  <li key={`${place.label}-${place.latitude}-${place.longitude}`}>
                    <button type="button" className="outfit-place" onClick={() => pickPlace(place)} disabled={busy}>
                      {place.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
      </section>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement(view)}
      </div>

      <section className="outfit-result" aria-busy={busy}>
        {(view.kind === 'locating' || view.kind === 'loading') && (
          <p className="outfit-loading">
            {view.kind === 'locating' ? 'Pidiendo tu ubicación… (puede tardar unos segundos)' : 'Consultando el clima y armando tu recomendación…'}
          </p>
        )}

        {view.kind === 'ok' && (
          <>
            <h2 ref={headingRef} tabIndex={-1} className="outfit-section-title">
              Tu perfume para hoy
            </h2>
            <article className="outfit-primary">
              <div className="outfit-primary-media">
                <PerfumeImage name={view.primary.name} brand={view.primary.brand} imageUrl={view.primary.imageUrl} accords={undefined} size="card" priority />
              </div>
              <div className="outfit-primary-body">
                <p className="perfume-brand">{view.primary.brand}</p>
                <h3 className="perfume-name">
                  <Link href={`/perfumes/${view.primary.perfumeId}`}>{view.primary.name}</Link>
                </h3>
                <p>
                  <span className="outfit-chip">{STATUS_LABELS[view.primary.status]}</span>
                </p>
                {view.primary.topAccords.length > 0 && (
                  <>
                    <p className="outfit-label">Acordes principales</p>
                    <ul className="perfume-badges" aria-label="Acordes principales">
                      {view.primary.topAccords.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </>
                )}
                {view.primary.reasons.length > 0 && (
                  <>
                    <p className="outfit-label">Por qué</p>
                    <ul className="outfit-reasons">
                      {view.primary.reasons.map((r) => (
                        <li key={r}>{REASON_LABELS[r] ?? r}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </article>

            <blockquote className="outfit-phrase">
              <p>{view.phrase.text}</p>
              {view.phrase.source === 'llm' && <footer className="outfit-ai-tag">Frase redactada con IA</footer>}
            </blockquote>

            <section aria-labelledby="outfit-weather-title" className="outfit-weather">
              <h3 id="outfit-weather-title" className="outfit-subtitle">
                El clima que usamos
              </h3>
              <dl className="outfit-weather-list">
                {describeWeather(view.weather).map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {view.alternatives.length > 0 && (
              <section aria-labelledby="outfit-alt-title">
                <h3 id="outfit-alt-title" className="outfit-subtitle">
                  Otras opciones
                </h3>
                <ul className="outfit-alt-list">
                  {view.alternatives.slice(0, 2).map((alt) => (
                    <CompactCard key={alt.perfumeId} pick={alt} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {view.kind === 'empty_collection' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Tu colección está vacía
            </h2>
            <p>
              Para recomendarte algo necesitamos perfumes tuyos. Guardalos desde el <Link href="/perfumes">catálogo</Link>.
            </p>
          </div>
        )}

        {view.kind === 'no_wearable' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              No tenés perfumes para recomendar
            </h2>
            <p>
              Solo tenés perfumes deseados o que no te gustan. Marcá alguno como “Lo tengo” o “Probado” en{' '}
              <Link href="/mi-coleccion">Mi colección</Link>.
            </p>
          </div>
        )}

        {view.kind === 'no_accords' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Nos faltan datos de tus perfumes
            </h2>
            <p>
              A los perfumes que tenés les faltan los acordes, y sin ellos no podemos saber cuáles van con el clima. Mirá otros en el{' '}
              <Link href="/perfumes">catálogo</Link>.
            </p>
          </div>
        )}

        {view.kind === 'denied' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              No pudimos usar tu ubicación
            </h2>
            <p>Sin ella no sabemos qué clima hace. Buscá tu ciudad en el formulario de arriba y seguimos.</p>
          </div>
        )}

        {view.kind === 'unauthorized' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Tu sesión venció
            </h2>
            <p>
              <Link href="/login">Ingresá de nuevo</Link> para ver tu recomendación.
            </p>
          </div>
        )}

        {view.kind === 'rate_limited' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Esperá unos segundos
            </h2>
            <p>
              Hiciste muchas consultas seguidas{view.seconds > 0 ? `; probá de nuevo en unos ${view.seconds} segundos` : ''}.
            </p>
          </div>
        )}

        {view.kind === 'weather_unavailable' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              No pudimos consultar el clima
            </h2>
            <p>El servicio del clima no responde ahora. Probá de nuevo en un rato.</p>
            <button type="button" className="button" onClick={retry}>
              Reintentar
            </button>
          </div>
        )}

        {view.kind === 'error' && (
          <div className="catalog-empty">
            <h2 ref={headingRef} tabIndex={-1} className="catalog-empty-title">
              Algo salió mal
            </h2>
            <p>No pudimos armar tu recomendación. Probá de nuevo.</p>
            <button type="button" className="button" onClick={retry}>
              Reintentar
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
