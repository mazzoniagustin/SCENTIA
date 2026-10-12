"use server";

import { redirect } from "next/navigation";

import { runMagicLinkAction } from "@/lib/auth/magic-link-action";
import { createClient } from "@/lib/supabase/server";

// Ingreso: solo para cuentas existentes (shouldCreateUser: false). El registro vive en /registro.
export async function requestMagicLink(formData: FormData) {
  await runMagicLinkAction("login", formData);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
