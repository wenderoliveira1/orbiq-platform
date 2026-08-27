import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/lib/public-environment";

export function createClient() {
  const { supabasePublishableKey, supabaseUrl } = getPublicEnvironment();

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
  );
}
