import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isNicknameTaken } from "@/lib/account/nickname-data";
import { sendMagicLink, type MagicLinkMode } from "@/lib/auth/magic-link";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const SEND_LIMIT = { limit: 5, windowMs: 60_000 };

/** Arma las dependencias reales de sendMagicLink y redirige a la página que corresponda. */
export async function runMagicLinkAction(mode: MagicLinkMode, formData: FormData): Promise<never> {
  const requestHeaders = await headers();

  // En producción el destino del enlace sale de SITE_URL: el header Origin lo controla quien hace la
  // solicitud y permitiría emitir enlaces de acceso hacia otro dominio. Solo en desarrollo se usa Origin.
  const origin =
    process.env.SITE_URL ?? (process.env.NODE_ENV === "production" ? null : requestHeaders.get("origin"));

  const supabase = await createClient();
  const destination = await sendMagicLink(
    mode,
    { email: formData.get("email"), nickname: formData.get("nickname") },
    {
      origin,
      allowRequest: () => rateLimit(`magic-link:${clientIp(requestHeaders)}`, SEND_LIMIT).ok,
      isNicknameTaken: (key) => isNicknameTaken(key),
      signInWithOtp: async (args) => {
        const { error } = await supabase.auth.signInWithOtp(args);
        return { error: error ? { code: error.code, status: error.status, message: error.message } : null };
      },
    },
  );
  redirect(destination);
}
