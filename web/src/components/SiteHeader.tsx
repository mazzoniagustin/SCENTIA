import Link from "next/link";
import { Suspense } from "react";

import { SiteNav } from "@/components/SiteNav";
import { getCurrentUser } from "@/lib/auth/session";
import { NAV_LINKS } from "@/lib/nav";

// Botón "Ingresar": solo si no hay sesión. Se resuelve aparte para no frenar el resto de la página.
async function HeaderCta() {
  const user = await getCurrentUser().catch(() => null);
  if (user) return null;
  return (
    <Link className="header-cta" href="/login">
      Ingresar
    </Link>
  );
}

// Cabecera fija con leve desenfoque. "Cuenta" lleva a /account, que redirige a /login si hace falta.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-wordmark" href="/">
          Scentia
        </Link>
        <SiteNav
          links={NAV_LINKS}
          cta={
            <Suspense fallback={<span className="header-cta header-cta-placeholder" aria-hidden="true">Ingresar</span>}>
              <HeaderCta />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}
