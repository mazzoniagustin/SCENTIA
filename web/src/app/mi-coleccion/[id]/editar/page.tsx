import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { getOwnPrivatePerfume } from "@/lib/private-perfumes/data";
import { displayImageUrls, isPhotoStorageAvailable } from "@/lib/private-perfumes/storage";
import { PrivatePerfumeForm } from "../../nuevo/PrivatePerfumeForm";

export const metadata = { title: "Editar perfume propio" };

export default async function EditPrivatePerfumePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) redirect("/login");

  const { id } = await params;
  const perfume = await getOwnPrivatePerfume(user.id, id);
  if (!perfume) notFound();

  const [accords, [photoUrl]] = await Promise.all([
    prisma.accord.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    displayImageUrls([{ status: "PRIVATE", imageUrl: perfume.imagePath }]),
  ]);

  return (
    <main id="contenido" className="catalog account-page private-perfume-page">
      <Link className="back-link" href={`/mi-coleccion/${perfume.id}`}>
        ← {perfume.name}
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Privado</p>
        <h1>Editar perfume propio</h1>
      </header>

      {isPhotoStorageAvailable() ? (
        <PrivatePerfumeForm
          accords={accords}
          initial={{
            id: perfume.id,
            name: perfume.name,
            brand: perfume.brand,
            perfumer: perfume.perfumer,
            gender: perfume.gender,
            description: perfume.description,
            topNotes: perfume.topNotes,
            heartNotes: perfume.heartNotes,
            baseNotes: perfume.baseNotes,
            longevity: perfume.longevity,
            sillage: perfume.sillage,
            accordIds: perfume.accords.map((a) => a.id),
            entry: perfume.entry,
            photoUrl,
          }}
        />
      ) : (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Esta función no está disponible por ahora.</p>
        </div>
      )}
    </main>
  );
}
