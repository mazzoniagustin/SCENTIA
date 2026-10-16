"use server";

import { redirect } from "next/navigation";

import { choosePassword } from "@/lib/auth/password-auth";
import { getCurrentUser } from "@/lib/auth/session";
import { limitAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Elegir contraseña (obligatorio para quien entró por enlace y no tiene una). Límite: 5 por minuto por persona.
export async function choosePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const destination = await choosePassword(
    { password: formData.get("password"), repeat: formData.get("repeat") },
    {
      canChoose: () => user.canChoosePassword,
      allowAction: () => limitAction("choosePassword", user.id, { limit: 5, windowMs: 60_000 }).ok,
      updateUser: async (args) => {
        const { error } = await supabase.auth.updateUser(args);
        return { error: error ? { code: error.code, status: error.status, message: error.message } : null };
      },
      refreshSession: async () => {
        const { error } = await supabase.auth.refreshSession();
        return { error: error ? { code: error.code, status: error.status, message: error.message } : null };
      },
    },
  );
  redirect(destination);
}
