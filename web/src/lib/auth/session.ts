import "server-only";

import { cache } from "react";

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

  return { id: claimsResult.claims.sub };
});
