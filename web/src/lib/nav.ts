// Navegación principal: qué enlace corresponde a la página actual. Lógica pura (sin navegador).

export type NavLink = { href: string; label: string }

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/perfumes", label: "Catálogo" },
  { href: "/marcas", label: "Marcas" },
  { href: "/quiz", label: "Quiz olfativo" },
  { href: "/mi-coleccion", label: "Mi colección" },
]

/** "Cuenta" solo se muestra con sesión (sin sesión /account redirige a /login, que ya está en la cabecera). */
export const ACCOUNT_LINK: NavLink = { href: "/account", label: "Cuenta" }

/** "Qué me pongo" usa la colección privada: solo se muestra con sesión (sin sesión /que-me-pongo redirige a /login). */
export const OUTFIT_LINK: NavLink = { href: "/que-me-pongo", label: "Qué me pongo" }

/** Enlaces del menú según haya sesión o no. */
export function navLinksFor(signedIn: boolean): readonly NavLink[] {
  return signedIn ? [...NAV_LINKS, OUTFIT_LINK, ACCOUNT_LINK] : NAV_LINKS
}

/** Un enlace está activo en su propia ruta y en las que cuelgan de ella ("/perfumes/abc" activa "Catálogo"), pero no en prefijos parecidos. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
