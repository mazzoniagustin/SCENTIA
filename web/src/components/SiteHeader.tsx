import Link from "next/link";
import { Suspense } from "react";

import { NavSignupLink } from "@/components/NavSignupLink";
import { SiteNav } from "@/components/SiteNav";
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
      <Link className="header-link" href="/registro">
        Crear cuenta
      </Link>
      <Link className="header-cta" href="/login">
        Ingresar
      </Link>
    </>
  );
}

// Enlace "Crear cuenta" del menú plegable: solo sin sesión (getCurrentUser lee el JWT local, sin consulta a la base).
async function MenuSignupLink() {
  const user = await getCurrentUser().catch(() => null);
  return user ? null : <NavSignupLink />;
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
          extraLink={
            <Suspense fallback={null}>
              <MenuSignupLink />
            </Suspense>
          }
          cta={
            <Suspense fallback={<span className="header-cta header-cta-placeholder" aria-hidden="true"><span className="header-placeholder-extra">Crear cuenta </span>Ingresar</span>}>
              <HeaderCta />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}
