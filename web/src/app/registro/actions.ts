"use server";

import { redirect } from "next/navigation";

import { runMagicLinkAction } from "@/lib/auth/magic-link-action";
import { signUpWithPassword } from "@/lib/auth/password-auth";
import { buildPasswordAuthDeps } from "@/lib/auth/password-action";

// Registro por enlace: crea la cuenta (shouldCreateUser: true) y manda el apodo (opcional) en los metadatos. El servidor lo
// vuelve a validar en el primer ingreso; lo que viaja en los metadatos no es de confianza.
export async function requestSignupLink(formData: FormData) {
  await runMagicLinkAction("signup", formData);
}

// Registro con correo, apodo (opcional) y contraseña. Con la confirmación de correo activa, la cuenta recién se usa al abrir el enlace.
export async function signUpWithPasswordAction(formData: FormData) {
  const deps = await buildPasswordAuthDeps("signup");
  redirect(
    await signUpWithPassword(
      { email: formData.get("email"), password: formData.get("password"), nickname: formData.get("nickname") },
      deps,
    ),
  );
}
