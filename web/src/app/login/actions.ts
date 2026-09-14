"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getLoginUrl(parameters: Record<string, string>) {
  const query = new URLSearchParams(parameters);
  return `/login?${query.toString()}`;
}

export async function requestMagicLink(formData: FormData) {
  const email = formData.get("email");

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(getLoginUrl({ error: "email" }));
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) {
    redirect(getLoginUrl({ error: "request" }));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: new URL("/auth/confirm", origin).toString(),
    },
  });

  if (error) {
    redirect(getLoginUrl({ error: "unavailable" }));
  }

  redirect(getLoginUrl({ sent: "1" }));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
