"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { runMagicLinkAction } from "@/lib/auth/magic-link-action";
import { signInWithPasswordCore } from "@/lib/auth/password-auth";
import { buildPasswordAuthDeps } from "@/lib/auth/password-action";
import { AFTER_LINK_CHOOSE_PASSWORD, AFTER_LINK_COOKIE } from "@/lib/auth/after-link";
import { createClient } from "@/lib/supabase/server";

// Ingreso por enlace: solo para cuentas existentes (shouldCreateUser: false). El registro vive en /registro.
export async function requestMagicLink(formData: FormData) {
  // Este formulario es el de "¿Olvidaste tu contraseña?": al abrir el enlace, /auth/confirm lleva a elegir una contraseña nueva.
  // Va en una cookie (y no en la URL del correo) porque Supabase exige que las Redirect URLs coincidan sin comodines.
  (await cookies()).set(AFTER_LINK_COOKIE, AFTER_LINK_CHOOSE_PASSWORD, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });
  await runMagicLinkAction("login", formData);
}

// Ingreso con correo y contraseña.
export async function signInWithPasswordAction(formData: FormData) {
  const deps = await buildPasswordAuthDeps("signin");
  redirect(await signInWithPasswordCore({ email: formData.get("email"), password: formData.get("password") }, deps));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
