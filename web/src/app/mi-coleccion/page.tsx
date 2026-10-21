import { getUserCollection } from '@/app/actions/collection';
import Link from 'next/link';
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from 'next/navigation';
import { parseStatusFilter } from '@/lib/collection/overview';
import { CollectionView } from './CollectionView';
import { GapsPanel } from './GapsPanel';
import { displayImageUrls } from '@/lib/private-perfumes/storage';

export const metadata = { title: "Mi colección" };

export default async function MyCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await getCurrentUser())) {
    redirect('/login');
  }

  const entries = await getUserCollection();
  // La foto de un perfume propio se guarda como ruta de Storage: se reemplaza por su URL firmada para mostrarla.
  const images = await displayImageUrls(entries.map((entry) => entry.perfume));
  const collection = entries.map((entry, i) => ({ ...entry, perfume: { ...entry.perfume, imageUrl: images[i] } }));
  const statusFilter = parseStatusFilter((await searchParams).estado);

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Privado</p>
        <h1>Mi colección</h1>
        <p className="catalog-header-actions">
          <Link className="button" href="/mi-coleccion/nuevo">
            Agregar perfume propio
          </Link>
        </p>
      </header>

      {collection.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Tu colección está vacía.</p>
          <p>
            Guardá perfumes desde el <Link href="/perfumes">catálogo</Link>, descubrí cuáles van con vos en el{" "}
            <Link href="/quiz">quiz</Link> o agregá uno que ya tengas con el botón “Agregar perfume propio”.
          </p>
        </div>
      ) : (
        <>
          <CollectionView collection={collection} statusFilter={statusFilter} />
          <GapsPanel />
        </>
      )}
    </main>
  );
}
