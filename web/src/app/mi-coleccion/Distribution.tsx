'use client';

import type { CSSProperties } from 'react';

import type { DistributionRow } from '@/lib/gaps/response';
import { countAt, staggerProgress, staggerTotalMs } from '@/lib/gaps/motion';
import { percent } from '@/lib/gaps/view';
import { useElapsed, useReveal } from './reveal';

const ROW_STEP_MS = 90; // cada fila arranca un poco después de la anterior
const ROW_MS = 950; // lo que tarda en llenarse una barra

// Distribución de la colección: las barras se llenan y los números cuentan de 0 al valor, fila por fila, cuando la lista entra
// en pantalla (no antes: así se ve aunque el detalle quede debajo del borde de la ventana). El significado está siempre en el
// texto (cuántos de tus perfumes): el color solo distingue las filas y el largo de la barra nunca es lo único que dice algo.
// El texto completo y final va en `sr-only`, y el que cuenta es decorativo. No se compara con el catálogo.
export function DistributionList({
  rows,
  caption,
  base,
  colorOf,
}: {
  rows: DistributionRow[];
  caption: string;
  base: number;
  colorOf?: (code: string) => string | undefined;
}) {
  const [ref, state] = useReveal<HTMLUListElement>(0.25);
  const elapsed = useElapsed(state === 'shown', state === 'static', staggerTotalMs(rows.length, ROW_STEP_MS, ROW_MS));
  const noun = base === 1 ? 'perfume' : 'perfumes';

  return (
    <ul ref={ref} className="gaps-dist" aria-label={caption} data-reveal={state}>
      {rows.map((r, i) => {
        const mine = percent(r.presence);
        const progress = staggerProgress(elapsed, i, ROW_STEP_MS, ROW_MS);
        const color = colorOf?.(r.code);
        const style = { ...(color ? { '--gaps-color': color } : {}) } as CSSProperties;
        const growing = progress > 0 && progress < 1;
        return (
          <li key={r.code} className="gaps-dist-row" style={style}>
            <p className="gaps-dist-label">
              {color && <span className="gaps-swatch" data-on={progress > 0} aria-hidden="true" />}
              {r.label}
            </p>
            <p className="gaps-dist-values">
              <span className="sr-only">
                {r.count} de {base} {noun} ({mine} %)
              </span>
              <span aria-hidden="true" className="gaps-count">
                {countAt(r.count, progress)} de {base} {noun} ({countAt(mine, progress)} %)
              </span>
            </p>
            <div className="gaps-bars" aria-hidden="true">
              <span
                className={growing ? 'gaps-bar gaps-bar-mine is-growing' : 'gaps-bar gaps-bar-mine'}
                style={{ width: `${mine}%`, transform: `scaleX(${progress})` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
