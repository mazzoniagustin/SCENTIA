import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { OutfitToday } from './OutfitToday';

export const metadata = { title: '¿Qué me pongo hoy?' };

export default async function WhatToWearPage() {
  if (!(await getCurrentUser())) {
    redirect('/login');
  }

  return (
    <main id="contenido" className="catalog outfit">
      <header className="catalog-header">
        <p className="eyebrow">Privado</p>
        <h1>¿Qué me pongo hoy?</h1>
        <p className="lead">
          Miramos el clima de donde estás y elegimos, entre los perfumes de tu colección, los que mejor van con el día.
        </p>
      </header>

      <noscript>
        <p className="outfit-noscript notice">
          Esta página necesita JavaScript para consultar el clima. Activalo en tu navegador o mirá tu colección a mano en{' '}
          <a href="/mi-coleccion">Mi colección</a>.
        </p>
      </noscript>

      <OutfitToday />

      <p className="outfit-attribution">
        Datos del clima:{' '}
        <a href="https://open-meteo.com/" rel="noopener noreferrer">
          Open-Meteo.com
        </a>{' '}
        (CC BY 4.0)
      </p>
    </main>
  );
}
