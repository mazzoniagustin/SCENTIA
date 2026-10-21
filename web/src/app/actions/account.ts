"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { deleteUserData, saveQuizAnswers, savePreferences } from "@/lib/account/data";
import { validateNickname } from "@/lib/account/nickname";
import { saveNickname } from "@/lib/account/nickname-data";
import { validatePreferences } from "@/lib/account/preferences";
import { changePassword } from "@/lib/auth/password-auth";
import { getExistingUserOrNull, requireUser } from "@/lib/auth/require-user";
import { logServerError } from "@/lib/log";
import { answersFromFormData, answersToSearchParams } from "@/lib/quiz/params";
import { validateAnswers } from "@/lib/quiz/profile";
import { limitAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { deleteAuthIdentity } from "@/lib/supabase/admin";
import { listOwnPhotoPaths } from "@/lib/private-perfumes/data";
import { removeAllPhotosOf } from "@/lib/private-perfumes/storage";

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
  // El apodo se ve en la cabecera, que es parte del layout raíz: hay que invalidarlo o queda el apodo viejo hasta recargar a mano.
  revalidatePath("/", "layout");
  redirect("/account?saved=nickname");
}

// Cambio de contraseña: exige la actual (se comprueba con el correo de la sesión) y respeta el límite de las acciones de cuenta.
export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  // El correo de acceso es el de Supabase Auth (el que acepta signInWithPassword), no el de la fila de la base.
  const authEmail = (await supabase.auth.getUser()).data.user?.email ?? user.email;
  const toError = (error: { code?: string; status?: number; message?: string } | null) =>
    error ? { code: error.code, status: error.status, message: error.message } : null;

  const destination = await changePassword(
    { current: formData.get("current"), password: formData.get("password"), repeat: formData.get("repeat") },
    {
      allowAction: () => !accountRateLimited("changePassword", user.id),
      verifyCurrent: async (password) => !(await supabase.auth.signInWithPassword({ email: authEmail, password })).error,
      updateUser: async (args) => ({ error: toError((await supabase.auth.updateUser(args)).error) }),
      refreshSession: async () => ({ error: toError((await supabase.auth.refreshSession()).error) }),
    },
  );
  redirect(destination);
}

// Elimina los datos de la persona (colección, perfil y racha, en cascada), guarda un resumen anónimo en la misma transacción
// (docs/retencion-eliminacion-cuenta.md) y cierra la sesión. Si la eliminación falla no se borra nada.
export async function deleteAccountAction(formData: FormData) {
  const user = await getExistingUserOrNull();
  if (!user) redirect("/login"); // sin sesión, o la cuenta ya se eliminó (doble envío): no crear un usuario vacío
  if (accountRateLimited("deleteAccount", user.id)) redirect("/account?error=rate");
  if (formData.get("confirm") !== DELETE_CONFIRMATION) redirect("/account?error=confirm");

  let failed = false;
  let photos: string[] = [];
  try {
    // Las fotos de los perfumes propios viven en Storage: se listan antes de borrar la fila y se eliminan después.
    photos = await listOwnPhotoPaths(user.id);
    await deleteUserData(user.id);
  } catch (error) {
    logServerError("account/delete", error);
    failed = true;
  }
  if (failed) redirect("/account?error=delete"); // fuera del try: redirect() lanza

  await removeAllPhotosOf(user.supabaseId, photos); // también las fotos subidas y nunca guardadas; no lanza: sin clave de servicio deja un aviso y la cuenta igual se elimina
  await deleteAuthIdentity(user.supabaseId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout"); // la cabecera no debe seguir mostrando el apodo de una cuenta que ya no existe
  redirect("/?cuenta=eliminada");
}
