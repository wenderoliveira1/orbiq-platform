import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { authSessionCookieOptions } from "@/lib/cookie-security";
import { getPublicEnvironment } from "@/lib/public-environment";

export async function createClient() {
  const cookieStore = await cookies();
  const { supabasePublishableKey, supabaseUrl } = getPublicEnvironment();
  const cookieDefaults = authSessionCookieOptions();

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookieOptions: cookieDefaults,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...cookieDefaults,
              });
            });
          } catch {
            // Server Components cannot always write cookies.
            // proxy.ts refreshes the session before rendering.
          }
        },
      },
    },
  );
}
