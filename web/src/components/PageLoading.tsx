import { LoadBar } from "./LoadBar";
import { CardGridSkeleton, Skeleton } from "./Skeleton";

// Esqueletos de página para los `loading.tsx`: se muestran al instante mientras el servidor arma la página.

export function HeaderSkeleton({ withLead = true }: { withLead?: boolean }) {
  return (
    <header className="catalog-header" aria-hidden="true">
      <Skeleton className="skeleton-line" style={{ width: "6rem", height: "0.8rem" }} />
      <Skeleton style={{ width: "min(22rem, 70%)", height: "3rem" }} />
      {withLead && <Skeleton className="skeleton-line" style={{ width: "min(30rem, 90%)" }} />}
    </header>
  );
}

export function GenericLoading() {
  return (
    <main className="catalog" aria-busy="true">
      <span className="sr-only" role="status">Cargando…</span>
      <HeaderSkeleton />
      <Skeleton style={{ height: "8rem", borderRadius: "1rem" }} />
      <Skeleton style={{ height: "8rem", borderRadius: "1rem" }} />
    </main>
  );
}

export function CatalogLoading() {
  return (
    <main className="catalog" aria-busy="true">
      <LoadBar label="Cargando perfumes" />
      <HeaderSkeleton withLead={false} />
      <Skeleton style={{ height: "6.5rem", borderRadius: "1rem" }} />
      <CardGridSkeleton count={8} />
    </main>
  );
}
