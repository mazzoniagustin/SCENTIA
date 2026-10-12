"use server";

import { runMagicLinkAction } from "@/lib/auth/magic-link-action";

// Registro: crea la cuenta (shouldCreateUser: true) y manda el apodo en los metadatos. El servidor lo
// vuelve a validar en el primer ingreso; lo que viaja en los metadatos no es de confianza.
export async function requestSignupLink(formData: FormData) {
  await runMagicLinkAction("signup", formData);
}
