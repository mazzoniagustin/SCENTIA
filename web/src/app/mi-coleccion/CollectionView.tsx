import Link from 'next/link';

import {
  STATUS_LABELS,
  STATUS_ORDER,
  countByStatus,
  filterByStatus,
  ratingLabel,
  type CollectionStatusValue,
} from '@/lib/collection/overview';
import { CollectionForm } from '../perfumes/CollectionForm';
import { PerfumeImage } from '../perfumes/PerfumeImage';
import { DeleteEntryForm } from './DeleteEntryForm';
import { DeletePrivatePerfumeForm } from './DeletePrivatePerfumeForm';

type Entry = {
  perfumeId: string;
  status: string;
  rating: number | null;
  personalNotes: string | null;
  perfume: {
    status: string;
    name: string;
    brand: string;
    imageUrl: string | null;
    accords: Parameters<typeof PerfumeImage>[0]['accords'];
  };
};

// Pestañas por estado (enlaces, sin JS) y las tarjetas de la colección con la edición plegada.
export function CollectionView({ collection, statusFilter }: { collection: Entry[]; statusFilter: CollectionStatusValue | null }) {
  const counts = countByStatus(collection);
  // Sin filtro, agrupado por estado (en el orden de las pestañas); el sort es estable y conserva el orden dentro de cada grupo.
  const visible = filterByStatus(collection, statusFilter).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status as CollectionStatusValue) - STATUS_ORDER.indexOf(b.status as CollectionStatusValue),
  );

  return (
    <>
      <nav className="collection-tabs" aria-label="Filtrar por estado">
        <ul>
          <li>
            <Link href="/mi-coleccion" aria-current={statusFilter === null ? 'page' : undefined}>
              Todos <span className="collection-tab-count">{collection.length}</span>
            </Link>
          </li>
          {STATUS_ORDER.map((status) => (
            <li key={status}>
              <Link href={`/mi-coleccion?estado=${status}`} aria-current={statusFilter === status ? 'page' : undefined}>
                {STATUS_LABELS[status]} <span className="collection-tab-count">{counts[status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">No tenés perfumes en “{statusFilter ? STATUS_LABELS[statusFilter] : ''}”.</p>
          <p>
            <Link href="/mi-coleccion">Ver toda la colección</Link>.
          </p>
        </div>
      ) : (
        <ul className="catalog-grid">
          {visible.map((entry) => {
            const own = entry.perfume.status === 'PRIVATE';
            return (
            <li key={entry.perfumeId} className="perfume-card">
              <PerfumeImage name={entry.perfume.name} brand={entry.perfume.brand} imageUrl={entry.perfume.imageUrl} accords={entry.perfume.accords} />
              <div className="perfume-card-body">
                {entry.perfume.brand && <p className="perfume-brand">{entry.perfume.brand}</p>}
                <h2 className="perfume-name">
                  <Link href={own ? `/mi-coleccion/${entry.perfumeId}` : `/perfumes/${entry.perfumeId}`}>{entry.perfume.name}</Link>
                </h2>
                <ul className="perfume-badges" aria-label="Estado y puntuación">
                  {own && <li className="perfume-badge-own">Propio</li>}
                  <li className={`collection-status-${entry.status.toLowerCase()}`}>
                    {STATUS_LABELS[entry.status as CollectionStatusValue] ?? entry.status}
                  </li>
                  {ratingLabel(entry.rating) && <li>★ {ratingLabel(entry.rating)}</li>}
                </ul>
                {entry.personalNotes && <p className="collection-notes">{entry.personalNotes}</p>}
                <div className="perfume-card-footer">
                  <details className="collection-edit">
                    <summary>Editar</summary>
                    <CollectionForm perfumeId={entry.perfumeId} initialData={entry} />
                  </details>
                  {own ? <DeletePrivatePerfumeForm perfumeId={entry.perfumeId} /> : <DeleteEntryForm perfumeId={entry.perfumeId} />}
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
