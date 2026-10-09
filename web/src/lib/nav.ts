// Navegación principal: qué enlace corresponde a la página actual. Lógica pura (sin navegador).

export type NavLink = { href: string; label: string }

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/perfumes", label: "Catálogo" },
  { href: "/marcas", label: "Marcas" },
  { href: "/quiz", label: "Quiz olfativo" },
  { href: "/mi-coleccion", label: "Mi colección" },
  { href: "/account", label: "Cuenta" },
]

/** Un enlace está activo en su propia ruta y en las que cuelgan de ella ("/perfumes/abc" activa "Catálogo"), pero no en prefijos parecidos. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
