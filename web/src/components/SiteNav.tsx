"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { isActivePath, type NavLink } from "@/lib/nav";

// Menú principal: marca el enlace de la página actual (`aria-current`) y en pantallas angostas se pliega detrás de un botón.
// Sin JavaScript el menú se ve completo (ver `@media (scripting: none)` en globals.css). `cta` es el botón "Ingresar", que queda visible fuera del menú plegado; `trailing` son los elementos del menú que dependen de la sesión ("Cuenta", o "Ingresar" + "Crear cuenta" en el celular).
export function SiteNav({ links, cta, trailing }: { links: readonly NavLink[]; cta: ReactNode; trailing?: ReactNode }) {
  const pathname = usePathname();
  // Se guarda en qué página se abrió el menú: al navegar deja de coincidir y queda cerrado, sin efectos que reseteen el estado.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Escape cierra el menú y devuelve el foco al botón.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOn(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Tocar o hacer clic fuera del menú y del botón lo cierra (sin mover el foco: la persona fue a otro lado).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (navRef.current?.contains(target) || toggleRef.current?.contains(target))) return;
      setOpenOn(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      <nav ref={navRef} id="site-nav" className="site-nav" aria-label="Principal" data-open={open}>
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} data-active={active}>
              {link.label}
            </Link>
          );
        })}
        {trailing}
      </nav>
      <div className="site-header-actions">
        {cta}
        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <span className="nav-toggle-bars" aria-hidden="true" />
          <span className="sr-only">{open ? "Cerrar el menú" : "Abrir el menú"}</span>
        </button>
      </div>
    </>
  );
}
