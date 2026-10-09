import { GenericLoading } from "@/components/PageLoading";

// Solo para el índice de marcas: el grupo (index) evita que envuelva a /marcas/[marca], que puede devolver 404.
export default function Loading() {
  return <GenericLoading />;
}
