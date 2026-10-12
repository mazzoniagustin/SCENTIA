"use client";

import { useEffect } from "react";

// Mueve el foco a un campo (por id) al montarse, para que el error ligado a él se anuncie junto con el campo.
// Sin JavaScript no hace nada: el `role="alert"` del mensaje alcanza.
export function FocusFieldOnMount({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.focus();
  }, [targetId]);

  return null;
}
