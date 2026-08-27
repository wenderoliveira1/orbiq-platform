import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/lib/public-environment";

export function createPublicSupabaseClient() {
  const { supabasePublishableKey, supabaseUrl } = getPublicEnvironment();

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
