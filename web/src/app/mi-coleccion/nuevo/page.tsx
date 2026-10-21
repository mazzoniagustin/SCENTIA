import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isPhotoStorageAvailable } from "@/lib/private-perfumes/storage";
import { PrivatePerfumeForm } from "./PrivatePerfumeForm";

export const metadata = { title: "Agregar perfume propio" };

export default async function NewPrivatePerfumePage() {
  if (!(await getCurrentUser())) redirect("/login");

  const accords = await prisma.accord.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main id="contenido" className="catalog private-perfume-page">
      <Link className="back-link" href="/mi-coleccion">
        ← Mi colección
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Privado</p>
        <h1>Agregar perfume propio</h1>
        <p>Para un perfume que tenés y no está en el catálogo. Queda solo en tu colección: nadie más lo ve.</p>
      </header>

      {isPhotoStorageAvailable() ? (
        <PrivatePerfumeForm accords={accords} />
      ) : (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Esta función no está disponible por ahora.</p>
          <p>No podemos guardar fotos en este momento. Probá de nuevo más tarde.</p>
        </div>
      )}
    </main>
  );
}
