"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

// Panel de "enviado" de /login y /registro: reemplaza al formulario. No muestra ni conserva el correo.
// Recibe el foco en el encabezado; sin JavaScript igual se anuncia por role="status".
export function CheckEmailPanel({
  children,
  retryHref,
}: {
  children: ReactNode;
  retryHref: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="check-email-panel notice" role="status">
      <h2 ref={headingRef} id="check-email-title" tabIndex={-1}>
        Revisá tu correo
      </h2>
      {children}
      <p>
        Puede tardar un minuto; mirá también la carpeta de spam. El enlace vence en un rato y sirve
        una sola vez.
      </p>
      <Link className="auth-link" href={retryHref}>
        Usar otro correo
      </Link>
    </div>
  );
}
