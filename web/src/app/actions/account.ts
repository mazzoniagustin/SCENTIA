"use server";

import { redirect } from "next/navigation";

import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { deleteUserData, saveQuizAnswers, savePreferences } from "@/lib/account/data";
import { validateNickname } from "@/lib/account/nickname";
import { saveNickname } from "@/lib/account/nickname-data";
import { validatePreferences } from "@/lib/account/preferences";
import { requireUser } from "@/lib/auth/require-user";
import { answersFromFormData, answersToSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { limitAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { deleteAuthIdentity } from "@/lib/supabase/admin";

// Límite compartido de las acciones de cuenta: 5 por minuto por persona. Al excederlo no se guarda nada.
function accountRateLimited(name: string, userId: string) {
  return !limitAction(name, userId, { limit: 5, windowMs: 60_000 }).ok;
}

// Guarda las respuestas del quiz de la persona con sesión y vuelve a los resultados.
export async function saveQuizProfile(formData: FormData) {
  const user = await requireUser();
  if (accountRateLimited("saveQuizProfile", user.id)) redirect("/account?error=rate");
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
  if (accountRateLimited("savePreferences", user.id)) redirect("/account?error=rate");
  const validated = validatePreferences({
    locale: formData.get("locale"),
    country: formData.get("country"),
    currency: formData.get("currency"),
  });
  if (!validated.ok) redirect("/account?error=preferences");

  await savePreferences(user.id, validated.value);
  redirect("/account?saved=preferences");
}

// Cambia el apodo (misma validación que el registro). Un apodo tomado se detecta con el índice único.
export async function saveNicknameAction(formData: FormData) {
  const user = await requireUser();
  if (accountRateLimited("saveNickname", user.id)) redirect("/account?error=rate");
  const validated = validateNickname(formData.get("nickname"));
  if (!validated.ok) redirect(`/account?error=${validated.error === "reserved" ? "nickname-reserved" : "nickname"}`);

  const result = await saveNickname(user.id, validated.nickname);
  if (result === "taken") redirect("/account?error=nickname-taken");
  redirect("/account?saved=nickname");
}

// Elimina los datos de la persona (colección y perfil, en cascada) y cierra la sesión.
export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser();
  if (accountRateLimited("deleteAccount", user.id)) redirect("/account?error=rate");
  if (formData.get("confirm") !== DELETE_CONFIRMATION) redirect("/account?error=confirm");

  await deleteUserData(user.id);
  await deleteAuthIdentity(user.supabaseId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
