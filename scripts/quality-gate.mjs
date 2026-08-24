import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import {
  spawnSync,
} from "node:child_process";

import {
  resolve,
} from "node:path";


const root =
  process.cwd();

const windows =
  process.platform ===
  "win32";


function run(
  name,
  command,
  args,
  options = {},
) {

  console.log("");
  console.log(
    "============================================================",
  );

  console.log(
    ` ${name}`,
  );

  console.log(
    "============================================================",
  );

  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          root,

        stdio:
          options.capture
            ? "pipe"
            : "inherit",

        encoding:
          "utf8",

        shell:
          windows,

        env:
          options.env ??
          process.env,
      },
    );


  if (
    result.error
  ) {

    console.error(
      result.error.message,
    );

    process.exit(
      1,
    );
  }


  if (
    result.status !==
    0
  ) {

    if (
      options.capture &&
      result.stdout
    ) {

      process.stdout.write(
        result.stdout,
      );
    }

    if (
      options.capture &&
      result.stderr
    ) {

      process.stderr.write(
        result.stderr,
      );
    }

    console.error("");
    console.error(
      `[FALHA] ${name}`,
    );

    process.exit(
      result.status ??
      1,
    );
  }


  console.log("");
  console.log(
    `[OK] ${name}`,
  );


  return result.stdout ??
    "";
}


function capture(
  command,
  args,
) {

  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          root,

        stdio:
          "pipe",

        encoding:
          "utf8",

        shell:
          windows,

        env:
          process.env,
      },
    );


  return {
    status:
      result.status,

    stdout:
      result.stdout ??
      "",

    stderr:
      result.stderr ??
      "",
  };
}


function normalize(
  value,
) {

  return String(
    value ??
    "",
  )
    .replace(
      /\r\n/g,
      "\n",
    )
    .trimEnd();
}


console.log("");
console.log(
  "============================================================",
);

console.log(
  " ORBIQ QUALITY GATE",
);

console.log(
  "============================================================",
);


// ============================================================
// NODE
// ============================================================

const major =
  Number(
    process.versions.node
      .split(
        ".",
      )[0],
  );


if (
  !Number.isFinite(
    major,
  ) ||
  major < 20
) {

  console.error(
    `Node.js invalido: ${process.versions.node}`,
  );

  process.exit(
    1,
  );
}


console.log(
  `[OK] Node.js ${process.versions.node}`,
);


// ============================================================
// ENV VERSIONADO
// ============================================================

const tracked =
  capture(
    "git",
    [
      "ls-files",
    ],
  );


if (
  tracked.status !==
  0
) {

  console.error(
    tracked.stderr,
  );

  process.exit(
    1,
  );
}


const envFiles =
  tracked.stdout
    .split(
      /\r?\n/,
    )
    .filter(
      Boolean,
    )
    .filter(
      (file) => {

        const name =
          file
            .replace(
              /\\/g,
              "/",
            )
            .split(
              "/",
            )
            .pop();

        return (
          name === ".env" ||
          name?.startsWith(
            ".env.",
          )
        );
      },
    );


if (
  envFiles.length >
  0
) {

  console.error(
    "Arquivos .env versionados:",
  );

  for (
    const file
    of envFiles
  ) {

    console.error(
      ` - ${file}`,
    );
  }

  process.exit(
    1,
  );
}


console.log(
  "[OK] Nenhum .env versionado",
);


// ============================================================
// MIGRATIONS
// ============================================================

const migrationsPath =
  resolve(
    root,
    "supabase",
    "migrations",
  );


if (
  !existsSync(
    migrationsPath,
  )
) {

  console.error(
    "Pasta de migrations ausente.",
  );

  process.exit(
    1,
  );
}


const migrations =
  readdirSync(
    migrationsPath,
  )
    .filter(
      (file) =>
        file.endsWith(
          ".sql",
        ),
    );


if (
  migrations.length ===
  0
) {

  console.error(
    "Nenhuma migration encontrada.",
  );

  process.exit(
    1,
  );
}


const invalid =
  migrations.filter(
    (file) =>
      !/^\d{14}_[a-z0-9_]+\.sql$/.test(
        file,
      ),
  );


if (
  invalid.length >
  0
) {

  console.error(
    "Nome de migration invalido:",
  );

  for (
    const file
    of invalid
  ) {

    console.error(
      ` - ${file}`,
    );
  }

  process.exit(
    1,
  );
}


console.log(
  `[OK] ${migrations.length} migrations`,
);


// ============================================================
// ESLINT
// ============================================================

run(
  "ESLint - zero warnings",
  "pnpm",
  [
    "--filter",
    "web",
    "exec",
    "eslint",
    ".",
    "--max-warnings=0",
  ],
);


// ============================================================
// TYPESCRIPT
// ============================================================

run(
  "TypeScript",
  "pnpm",
  [
    "--filter",
    "web",
    "exec",
    "tsc",
    "--noEmit",
  ],
);


// ============================================================
// SUPABASE
// ============================================================

let status =
  capture(
    "pnpm",
    [
      "exec",
      "supabase",
      "status",
    ],
  );


if (
  status.status !==
  0
) {

  console.log(
    "Supabase desligado. Iniciando...",
  );

  run(
    "Supabase Start",
    "pnpm",
    [
      "exec",
      "supabase",
      "start",
    ],
  );


  status =
    capture(
      "pnpm",
      [
        "exec",
        "supabase",
        "status",
      ],
    );
}


if (
  status.status !==
  0
) {

  console.error(
    "Supabase local indisponivel.",
  );

  console.error(
    status.stderr,
  );

  process.exit(
    1,
  );
}


console.log(
  "[OK] Supabase local",
);


// ============================================================
// POSTGRESQL LINT
// ============================================================

run(
  "PostgreSQL / Supabase Lint",
  "pnpm",
  [
    "exec",
    "supabase",
    "db",
    "lint",
    "--local",
  ],
);


// ============================================================
// DATABASE TYPES
// ============================================================

const generated =
  run(
    "Gerando Database Types",
    "pnpm",
    [
      "exec",
      "supabase",
      "gen",
      "types",
      "--lang",
      "typescript",
      "--local",
      "--schema",
      "public",
    ],
    {
      capture:
        true,
    },
  );


const committed =
  readFileSync(
    resolve(
      root,
      "packages",
      "types",
      "src",
      "database.types.ts",
    ),
    "utf8",
  );


if (
  normalize(
    generated,
  ) !==
  normalize(
    committed,
  )
) {

  console.error("");
  console.error(
    "DATABASE TYPES DESATUALIZADOS.",
  );

  console.error(
    "O banco local e database.types.ts nao correspondem.",
  );

  process.exit(
    1,
  );
}


console.log(
  "[OK] Database Types sincronizados",
);


// ============================================================
// SUPABASE ENV PARA O NEXT BUILD
// ============================================================

const envOutput =
  capture(
    "pnpm",
    [
      "exec",
      "supabase",
      "status",
      "-o",
      "env",
    ],
  );


const buildEnv =
  {
    ...process.env,
  };


if (
  envOutput.status ===
  0
) {

  const values =
    {};


  for (
    const rawLine
    of envOutput.stdout.split(
      /\r?\n/,
    )
  ) {

    const line =
      rawLine.trim();


    const match =
      line.match(
        /^([A-Z0-9_]+)=(.*)$/,
      );


    if (!match) {
      continue;
    }


    let value =
      match[2].trim();


    if (
      value.startsWith(
        '"',
      ) &&
      value.endsWith(
        '"',
      )
    ) {

      value =
        value.slice(
          1,
          -1,
        );
    }


    values[
      match[1]
    ] =
      value;
  }


  if (
    values.API_URL
  ) {

    buildEnv.NEXT_PUBLIC_SUPABASE_URL =
      values.API_URL;
  }


  const publicKey =
    values.PUBLISHABLE_KEY ??
    values.ANON_KEY;


  if (
    publicKey
  ) {

    buildEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      publicKey;

    buildEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      publicKey;
  }
}


// ============================================================
// BUILD
// ============================================================

run(
  "Next.js Production Build",
  "pnpm",
  [
    "--filter",
    "web",
    "build",
  ],
  {
    env:
      buildEnv,
  },
);


// ============================================================
// SUCESSO
// ============================================================

console.log("");
console.log(
  "============================================================",
);

console.log(
  " ORBIQ QUALITY GATE APROVADO",
);

console.log(
  "============================================================",
);

console.log("");

console.log(
  "[OK] Secrets",
);

console.log(
  "[OK] Migrations",
);

console.log(
  "[OK] ESLint",
);

console.log(
  "[OK] TypeScript",
);

console.log(
  "[OK] Supabase",
);

console.log(
  "[OK] PostgreSQL Lint",
);

console.log(
  "[OK] Database Types",
);

console.log(
  "[OK] Next.js Build",
);