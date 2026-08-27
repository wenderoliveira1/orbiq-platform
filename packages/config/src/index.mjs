const PUBLIC_KEY_PREFIX = "sb_publishable_";
const SECRET_KEY_PREFIX = "sb_secret_";

export const PUBLIC_ENVIRONMENT_NAMES = Object.freeze([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

export class PublicEnvironmentError extends Error {
  constructor(code, variableName, message) {
    super(message);
    this.name = "PublicEnvironmentError";
    this.code = code;
    this.variableName = variableName;
  }
}

function requiredValue(source, variableName) {
  const value = source?.[variableName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PublicEnvironmentError(
      "missing",
      variableName,
      `Configuração obrigatória ausente: ${variableName}.`,
    );
  }

  return value.trim();
}

function normalizedOrigin(source, variableName) {
  const value = requiredValue(source, variableName);
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new PublicEnvironmentError(
      "invalid_url",
      variableName,
      `${variableName} deve ser uma URL absoluta válida.`,
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new PublicEnvironmentError(
      "invalid_protocol",
      variableName,
      `${variableName} deve usar http:// ou https://.`,
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new PublicEnvironmentError(
      "invalid_origin",
      variableName,
      `${variableName} deve conter somente a origem, sem credenciais, caminho, query ou fragmento.`,
    );
  }

  return url.origin;
}

function decodeBase64Url(input) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let accumulator = 0;
  let bitCount = 0;
  let output = "";

  for (const character of input) {
    const value = alphabet.indexOf(character);

    if (value < 0) {
      throw new Error("JWT base64url inválido.");
    }

    accumulator = (accumulator << 6) | value;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      output += String.fromCharCode((accumulator >> bitCount) & 0xff);
    }
  }

  return output;
}

function legacyJwtRole(value) {
  const segments = value.split(".");

  if (segments.length !== 3 || !segments[1]) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(segments[1]));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function publishableKey(source) {
  const variableName = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  const value = requiredValue(source, variableName);

  if (
    value.startsWith(SECRET_KEY_PREFIX) ||
    /service[_-]?role/i.test(value)
  ) {
    throw new PublicEnvironmentError(
      "privileged_key",
      variableName,
      "Uma chave privilegiada do Supabase nunca pode ser publicada no cliente.",
    );
  }

  if (
    value.startsWith(PUBLIC_KEY_PREFIX) &&
    value.length > PUBLIC_KEY_PREFIX.length + 15
  ) {
    return value;
  }

  const jwtRole = legacyJwtRole(value);

  if (jwtRole === "anon") {
    return value;
  }

  if (jwtRole === "service_role") {
    throw new PublicEnvironmentError(
      "privileged_key",
      variableName,
      "Uma chave privilegiada do Supabase nunca pode ser publicada no cliente.",
    );
  }

  throw new PublicEnvironmentError(
    "invalid_publishable_key",
    variableName,
    "Use uma chave sb_publishable_... ou uma chave anon JWT legada válida.",
  );
}

export function parsePublicEnvironment(source) {
  const environment = {
    appUrl: normalizedOrigin(source, "NEXT_PUBLIC_APP_URL"),
    supabaseUrl: normalizedOrigin(source, "NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: publishableKey(source),
  };

  return Object.freeze(environment);
}
