"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath } from "@/lib/nav";

// "Crear cuenta" dentro del menú plegable. Solo se ve a ≤ 30rem (el CSS lo oculta con display:none al resto);
// a más ancho el mismo enlace vive en la cabecera. Se renderiza solo sin sesión (lo decide SiteHeader).
export function NavSignupLink() {
  const pathname = usePathname();
  const active = isActivePath(pathname, "/registro");
  return (
    <Link className="nav-signup" href="/registro" aria-current={active ? "page" : undefined} data-active={active}>
      Crear cuenta
    </Link>
  );
}
