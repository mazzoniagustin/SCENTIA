'use client';

import type { CSSProperties } from 'react';

import { splitWords } from '@/lib/gaps/motion';
import { useReveal } from './reveal';

// Titular del resultado: las palabras aparecen una tras otra al entrar en pantalla. El texto es el mismo (palabras separadas
// por espacios normales), así que un lector de pantalla lo lee entero y, sin movimiento, se ve todo de entrada.
export function Headline({ text }: { text: string }) {
  const [ref, state] = useReveal<HTMLParagraphElement>(0.5);
  const words = splitWords(text);
  return (
    <p ref={ref} className="gaps-headline" data-reveal={state}>
      {words.map((word, i) => (
        <span key={`${i}-${word}`}>
          <span className="gaps-word" style={{ '--w': i } as CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
