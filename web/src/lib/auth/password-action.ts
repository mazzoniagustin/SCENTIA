import "server-only";

import { headers } from "next/headers";

import { isNicknameTaken } from "@/lib/account/nickname-data";
import type { PasswordAuthDeps } from "@/lib/auth/password-auth";
import { logServerError } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const ATTEMPT_LIMIT = { limit: 10, windowMs: 60_000 };

/** Dependencias reales del registro y el ingreso con contraseña (límite por IP, SITE_URL como destino del correo). */
export async function buildPasswordAuthDeps(scope: "signup" | "signin"): Promise<PasswordAuthDeps> {
  const requestHeaders = await headers();
  // Igual que el enlace mágico: en producción el destino sale de SITE_URL, no del header Origin (lo controla quien llama).
  const origin =
    process.env.SITE_URL ?? (process.env.NODE_ENV === "production" ? null : requestHeaders.get("origin"));
  const supabase = await createClient();
  const toError = (error: { code?: string; status?: number; message?: string } | null) =>
    error ? { code: error.code, status: error.status, message: error.message } : null;

  return {
    origin,
    allowRequest: () => rateLimit(`password-${scope}:${clientIp(requestHeaders)}`, ATTEMPT_LIMIT).ok,
    isNicknameTaken: (key) => isNicknameTaken(key),
    report: (scope, detail) => logServerError(scope, new Error(detail)),
    signUp: async (args) => ({ error: toError((await supabase.auth.signUp(args)).error) }),
    signInWithPassword: async (args) => ({ error: toError((await supabase.auth.signInWithPassword(args)).error) }),
  };
}
