import { getUserCollection } from '@/app/actions/collection';
import Link from 'next/link';
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from 'next/navigation';
import { parseStatusFilter } from '@/lib/collection/overview';
import { CollectionView } from './CollectionView';
import { GapsPanel } from './GapsPanel';

export const metadata = { title: "Mi colección" };

export default async function MyCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!(await getCurrentUser())) {
    redirect('/login');
  }

  const collection = await getUserCollection();
  const statusFilter = parseStatusFilter((await searchParams).estado);

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Privado</p>
        <h1>Mi colección</h1>
      </header>

      {collection.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Tu colección está vacía.</p>
          <p>
            Guardá perfumes desde el <Link href="/perfumes">catálogo</Link> o descubrí cuáles van con vos en el{" "}
            <Link href="/quiz">quiz</Link>.
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
