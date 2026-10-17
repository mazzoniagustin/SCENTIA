import Link from "next/link";
import { Suspense } from "react";

import { BrandImage } from "@/components/BrandImage";
import { NavAccountLink, NavAuthActions } from "@/components/NavSignupLink";
import { SiteNav } from "@/components/SiteNav";
import { getBrandAsset } from "@/lib/brand-assets";
import { getSessionNickname } from "@/lib/auth/db-user";
import { getCurrentUser } from "@/lib/auth/session";
import { NAV_LINKS } from "@/lib/nav";

// Acciones de sesión: "Ingresar" y "Crear cuenta" sin sesión; con sesión, el apodo (o "Mi cuenta") lleva a /account.
// Se resuelve aparte para no frenar el resto de la página.
async function HeaderCta() {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    const nickname = await getSessionNickname().catch(() => null);
    return (
      <Link className="header-cta header-nickname" href="/account">
        {nickname ?? "Mi cuenta"}
      </Link>
    );
  }
  return (
    <>
      <Link className="header-link header-guest" href="/registro">
        Crear cuenta
      </Link>
      <Link className="header-cta header-guest" href="/login">
        Ingresar
      </Link>
    </>
  );
}

// Parte del menú que depende de la sesión: "Cuenta" con sesión; "Ingresar" + "Crear cuenta" (solo celular) sin sesión.
// getCurrentUser lee el JWT local, sin consulta a la base.
async function SessionNavItems() {
  const user = await getCurrentUser().catch(() => null);
  return user ? <NavAccountLink /> : <NavAuthActions />;
}

// Cabecera fija con leve desenfoque.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* Con el logo cargado (public/brand/logo.svg) reemplaza al texto; su alt ya dice "Scentia". */}
        <Link className="site-wordmark" href="/">
          {getBrandAsset("logo") ? <BrandImage slot="logo" className="site-logo" priority /> : "Scentia"}
        </Link>
        <SiteNav
          links={NAV_LINKS}
          trailing={
            <Suspense fallback={<span className="nav-account-placeholder" aria-hidden="true">Cuenta</span>}>
              <SessionNavItems />
            </Suspense>
          }
          cta={
            <Suspense fallback={<span className="header-cta header-cta-placeholder header-guest" aria-hidden="true"><span className="header-placeholder-extra">Crear cuenta </span>Ingresar</span>}>
              <HeaderCta />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}
