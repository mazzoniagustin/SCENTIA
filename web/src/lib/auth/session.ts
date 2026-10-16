import "server-only";

import { cache } from "react";

import { canChoosePassword, getPasswordSet } from "@/lib/auth/password-gate";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: claimsResult,
    error,
  } = await supabase.auth.getClaims();

  if (error || !claimsResult?.claims?.sub) {
    return null;
  }

  return {
    id: claimsResult.claims.sub,
    passwordSet: getPasswordSet(claimsResult.claims),
    canChoosePassword: canChoosePassword(claimsResult.claims, Math.floor(Date.now() / 1000)),
  };
});
