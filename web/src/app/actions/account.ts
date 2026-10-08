"use server";

import { redirect } from "next/navigation";

import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { deleteUserData, saveQuizAnswers, savePreferences } from "@/lib/account/data";
import { validatePreferences } from "@/lib/account/preferences";
import { requireUser } from "@/lib/auth/require-user";
import { answersFromFormData, answersToSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { createClient } from "@/lib/supabase/server";
import { deleteAuthIdentity } from "@/lib/supabase/admin";

// Guarda las respuestas del quiz de la persona con sesión y vuelve a los resultados.
export async function saveQuizProfile(formData: FormData) {
  const user = await requireUser();
  const validated = validateAnswers(answersFromFormData(formData));
  if (!validated.ok) redirect("/quiz");

  await saveQuizAnswers(user.id, validated.answers);

  const gender = formData.get("gender");
  const extra: Record<string, string> = { guardado: "1" };
  if (typeof gender === "string" && gender) extra.gender = gender;
  redirect(`/quiz/resultado?${answersToSearchParams(validated.answers, extra).toString()}`);
}

export async function savePreferencesAction(formData: FormData) {
  const user = await requireUser();
  const validated = validatePreferences({
    locale: formData.get("locale"),
    country: formData.get("country"),
    currency: formData.get("currency"),
  });
  if (!validated.ok) redirect("/account?error=preferences");

  await savePreferences(user.id, validated.value);
  redirect("/account?saved=preferences");
}

// Elimina los datos de la persona (colección y perfil, en cascada) y cierra la sesión.
export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser();
  if (formData.get("confirm") !== DELETE_CONFIRMATION) redirect("/account?error=confirm");

  await deleteUserData(user.id);
  await deleteAuthIdentity(user.supabaseId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
