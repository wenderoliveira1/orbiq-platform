import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type AutoQaState = {
  email: string;
  password: string;
  userId: string;
  organizationId: string;
  customerId: string;
  vehicleId: string;
  supplierId: string;
  marginQuoteId: string;
  savedQuoteId: string;
  publicApproveQuoteId: string;
  publicRejectQuoteId: string;
  publicApproveToken: string;
  publicRejectToken: string;
  publicApproveCreatedAt: string;
  publicApproveExpiresAt: string;
  publicRejectCreatedAt: string;
  publicRejectExpiresAt: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}

export function autoQaEnv() {
  return {
    url: required("AUTOQA_SUPABASE_URL").replace(/\/$/, ""),
    publicKey: required("AUTOQA_SUPABASE_PUBLIC_KEY"),
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status} ${response.statusText}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`,
    );
  }

  return data;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  apiKey?: string;
  prefer?: string;
};

async function request(path: string, options: RequestOptions = {}) {
  const { url, publicKey } = autoQaEnv();
  const apiKey = options.apiKey ?? publicKey;
  const headers: Record<string, string> = {
    apikey: apiKey,
    "Content-Type": "application/json",
    ...(options.prefer ? { Prefer: options.prefer } : {}),
  };

  const authorization =
    options.accessToken === undefined ? apiKey : options.accessToken;

  if (authorization) {
    headers.Authorization = `Bearer ${authorization}`;
  }

  const response = await fetch(`${url}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined
      ? {}
      : {
          body: JSON.stringify(options.body),
        }),
  });

  return parseResponse(response);
}

export async function signUp(email: string, password: string) {
  const { publicKey } = autoQaEnv();

  const data = (await request("/auth/v1/signup", {
    method: "POST",
    apiKey: publicKey,
    accessToken: publicKey,
    body: {
      email,
      password,
      data: {
        full_name: "Orbiq AutoQA Owner",
      },
    },
  })) as {
    access_token?: string;
    user?: {
      id?: string;
    };
  };

  if (!data.access_token || !data.user?.id) {
    throw new Error(`Signup AutoQA incompleto: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    userId: data.user.id,
  };
}

export async function signIn(email: string, password: string) {
  const { publicKey } = autoQaEnv();

  const data = (await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    apiKey: publicKey,
    accessToken: publicKey,
    body: {
      email,
      password,
    },
  })) as {
    access_token?: string;
    user?: {
      id?: string;
    };
  };

  if (!data.access_token || !data.user?.id) {
    throw new Error(`Login AutoQA incompleto: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    userId: data.user.id,
  };
}

export async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  accessToken: string,
): Promise<T> {
  return (await request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: args,
    accessToken,
  })) as T;
}

export async function insertRows<T>(
  table: string,
  rows: unknown,
  accessToken: string,
): Promise<T> {
  return (await request(`/rest/v1/${table}`, {
    method: "POST",
    body: rows,
    accessToken,
    prefer: "return=representation",
  })) as T;
}

export async function patchRows<T>(
  table: string,
  query: string,
  values: unknown,
  accessToken: string,
): Promise<T> {
  return (await request(`/rest/v1/${table}?${query}`, {
    method: "PATCH",
    body: values,
    accessToken,
    prefer: "return=representation",
  })) as T;
}

export async function selectRows<T>(
  table: string,
  query: string,
  accessToken: string,
): Promise<T> {
  return (await request(`/rest/v1/${table}?${query}`, {
    accessToken,
  })) as T;
}

export function sqlLiteral(value: string | null): string {
  if (value === null) {
    return "null";
  }

  return `'${value.replace(/'/g, "''")}'`;
}

export function runPostgres(sql: string): string {
  const container =
    process.env.AUTOQA_POSTGRES_CONTAINER?.trim() ||
    "supabase_db_orbiq-platform";

  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: process.cwd(),
      input: sql,
      encoding: "utf8",
      env: process.env,
    },
  );

  if (result.error) {
    throw new Error(`Falha executando PostgreSQL AutoQA: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      [
        "PostgreSQL AutoQA retornou erro.",
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return (result.stdout ?? "").trim();
}

export async function loadState(): Promise<AutoQaState> {
  const path = resolve(process.cwd(), ".autoqa", "state.json");
  return JSON.parse(await readFile(path, "utf8")) as AutoQaState;
}
