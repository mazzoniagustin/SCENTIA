"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Mensaje de error que recibe el foco al montarse, para que quien navega con teclado o lector llegue directo a él.
// Sin JavaScript queda como un párrafo normal: `role="alert"` igual lo anuncia.
export function FocusOnMount({ children, id }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <p ref={ref} id={id} className="error-message" role="alert" tabIndex={-1}>
      {children}
    </p>
  );
}
