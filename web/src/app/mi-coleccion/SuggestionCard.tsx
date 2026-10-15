'use client';

import Link from 'next/link';
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import type { GapsResponse } from '@/lib/gaps/response';
import { tiltFor } from '@/lib/gaps/motion';
import { PerfumeImage } from '../perfumes/PerfumeImage';

type Suggestion = GapsResponse['suggestions'][number];

// Solo con mouse (puntero fino con hover) y sin pedido de menos movimiento: el dedo y el teclado no inclinan nada.
const FINE_POINTER = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

// Tarjeta del rollo. Con el mouse se inclina un poco hacia el cursor y un brillo dorado lo acompaña (variables CSS escritas
// directo en el elemento, sin volver a renderizar). Sin mouse, o con menos movimiento, queda quieta y completa.
export function SuggestionCard({ s, index }: { s: Suggestion; index: number }) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  const onMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    const el = linkRef.current;
    if (!el || event.pointerType !== 'mouse' || !window.matchMedia(FINE_POINTER).matches) return;
    const rect = el.getBoundingClientRect();
    const tilt = tiltFor(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, 5);
    el.style.setProperty('--rx', `${tilt.rotateX}deg`);
    el.style.setProperty('--ry', `${tilt.rotateY}deg`);
    el.style.setProperty('--mx', `${tilt.glowX}%`);
    el.style.setProperty('--my', `${tilt.glowY}%`);
  };

  const onLeave = () => {
    const el = linkRef.current;
    if (!el) return;
    for (const name of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(name);
  };

  return (
    <li className="scroller-item outfit-alt gaps-suggestion" style={{ '--i': index } as CSSProperties}>
      <Link
        ref={linkRef}
        href={`/perfumes/${s.perfumeId}`}
        className="outfit-alt-link gaps-card"
        draggable={false}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <span className="outfit-alt-media gaps-card-media">
          <PerfumeImage name={s.name} brand={s.brand} imageUrl={s.imageUrl} size="thumb" />
        </span>
        <span className="outfit-alt-text">
          <span className="perfume-brand">{s.brand}</span>
          <span className="outfit-alt-name">{s.name}</span>
          {s.covers.length > 0 && <span className="gaps-covers">Cubre: {s.covers.join(', ')}</span>}
          {s.inWishlist && s.wishlistNote && <span className="outfit-chip gaps-wish">{s.wishlistNote}</span>}
        </span>
      </Link>
    </li>
  );
}
