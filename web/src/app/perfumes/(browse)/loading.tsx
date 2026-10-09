import { CatalogLoading } from "@/components/PageLoading";

// Solo para el listado: el grupo (browse) evita que este esqueleto envuelva a la ficha, que necesita devolver 404 real.
export default function Loading() {
  return <CatalogLoading />;
}
