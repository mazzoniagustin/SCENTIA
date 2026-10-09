import { getUserCollection, deleteCollectionEntry } from '@/app/actions/collection';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { CollectionForm } from '../perfumes/CollectionForm';
import { PerfumeImage } from '../perfumes/PerfumeImage';
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from 'next/navigation';

export const metadata = { title: "Mi colección" };

export default async function MyCollectionPage() {
  if (!(await getCurrentUser())) {
    redirect('/login');
  }

  const collection = await getUserCollection();

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
        <ul className="catalog-grid">
          {collection.map((entry) => (
            <li key={entry.perfumeId} className="perfume-card">
              <PerfumeImage name={entry.perfume.name} brand={entry.perfume.brand} imageUrl={entry.perfume.imageUrl} accords={entry.perfume.accords} />
              <div className="perfume-card-body">
                <p className="perfume-brand">{entry.perfume.brand}</p>
                <h2 className="perfume-name">
                  <Link href={`/perfumes/${entry.perfumeId}`}>{entry.perfume.name}</Link>
                </h2>
                <div className="perfume-card-footer">
                  <CollectionForm perfumeId={entry.perfumeId} initialData={entry} />
                  <form action={async () => {
                    'use server';
                    await deleteCollectionEntry(entry.perfumeId);
                    revalidatePath('/mi-coleccion');
                  }}>
                    <button type="submit" className="button-danger">Eliminar</button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
