"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ACCOUNT_LINK, isActivePath, OUTFIT_LINK } from "@/lib/nav";

// Enlaces de sesión dentro del menú plegable. Los de "Ingresar"/"Crear cuenta" solo se ven a ≤ 30rem (el CSS los oculta con
// display:none al resto, así nunca hay dos enlaces iguales anunciados); a más ancho viven en la cabecera. Se renderizan solo sin sesión.

function NavAuthLink({ href, className, children }: { href: string; className: string; children: string }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);
  return (
    <Link className={className} href={href} aria-current={active ? "page" : undefined} data-active={active}>
      {children}
    </Link>
  );
}

export function NavSignupLink() {
  return (
    <NavAuthLink href="/registro" className="nav-signup">
      Crear cuenta
    </NavAuthLink>
  );
}

// "Ingresar" + "Crear cuenta" juntos, separados del resto de los enlaces.
export function NavAuthActions() {
  return (
    <div className="nav-auth">
      <NavAuthLink href="/login" className="nav-login">
        Ingresar
      </NavAuthLink>
      <NavSignupLink />
    </div>
  );
}

// "Qué me pongo" y "Cuenta": solo con sesión.
export function NavAccountLink() {
  const pathname = usePathname();
  return (
    <>
      {[OUTFIT_LINK, ACCOUNT_LINK].map((link) => {
        const active = isActivePath(pathname, link.href);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} data-active={active}>
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
