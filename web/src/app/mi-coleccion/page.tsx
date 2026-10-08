import { getUserCollection, deleteCollectionEntry } from '@/app/actions/collection';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { CollectionForm } from '../perfumes/CollectionForm';
import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';

export default async function MyCollectionPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect('/login');
  }

  const collection = await getUserCollection();

  return (
    <main className="catalog">
      <header className="catalog-header">
        <h1>Mi Colección</h1>
        <Link href="/perfumes">← Volver al catálogo</Link>
      </header>

      {collection.length === 0 ? (
        <p>Tu colección está vacía.</p>
      ) : (
        <ul className="catalog-grid">
          {collection.map((entry) => (
            <li key={entry.perfumeId} className="perfume-card">
              <h2>{entry.perfume.name}</h2>
              <CollectionForm perfumeId={entry.perfumeId} initialData={entry} />
              <form action={async () => {
                'use server';
                await deleteCollectionEntry(entry.perfumeId);
                revalidatePath('/mi-coleccion');
              }}>
                <button type="submit" className="button-danger">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
