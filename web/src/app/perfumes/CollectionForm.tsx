import { upsertCollectionEntry } from '@/app/actions/collection';
import { revalidatePath } from 'next/cache';

export function CollectionForm({ perfumeId, initialData }: { perfumeId: string, initialData?: { status: string; rating?: number | null; personalNotes?: string | null } }) {
  async function action(formData: FormData) {
    'use server';
    const status = formData.get('status') as 'OWNED' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED';
    const rating = Number(formData.get('rating'));
    const personalNotes = formData.get('personalNotes') as string;

    await upsertCollectionEntry({
      perfumeId,
      status,
      rating: rating || undefined,
      personalNotes: personalNotes || undefined,
    });
    revalidatePath('/perfumes');
    revalidatePath('/mi-coleccion');
  }

  return (
    <form action={action} className="collection-form">
      <select name="status" defaultValue={initialData?.status || 'WISHLIST'}>
        <option value="OWNED">Owned</option>
        <option value="SAMPLED">Sampled</option>
        <option value="WISHLIST">Wishlist</option>
        <option value="DISLIKED">Disliked</option>
      </select>
      <input type="number" name="rating" min="1" max="5" defaultValue={initialData?.rating ?? undefined} placeholder="Rating (1-5)" />
      <textarea name="personalNotes" maxLength={2000} defaultValue={initialData?.personalNotes ?? undefined} placeholder="Notas personales" />
      <button type="submit">Guardar</button>
    </form>
  );
}
