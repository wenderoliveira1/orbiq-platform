export type PublicEnvironmentSource = Readonly<{
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}>;

export type PublicEnvironment = Readonly<{
  appUrl: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}>;

export declare const PUBLIC_ENVIRONMENT_NAMES: readonly [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

export declare class PublicEnvironmentError extends Error {
  readonly code: string;
  readonly variableName: keyof PublicEnvironmentSource;

  constructor(
    code: string,
    variableName: keyof PublicEnvironmentSource,
    message: string,
  );
}

export declare function parsePublicEnvironment(
  source: PublicEnvironmentSource,
): PublicEnvironment;
