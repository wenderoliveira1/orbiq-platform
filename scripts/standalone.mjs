import { cpSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { parsePublicEnvironment } from "../packages/config/src/index.mjs";

const repositoryRoot = process.cwd();
const webRoot = resolve(repositoryRoot, "apps", "web");
const standaloneRoot = resolve(webRoot, ".next", "standalone");
const nestedServerRoot = resolve(standaloneRoot, "apps", "web");
const serverRoot = existsSync(resolve(nestedServerRoot, "server.js"))
  ? nestedServerRoot
  : standaloneRoot;
const serverFile = resolve(serverRoot, "server.js");

if (!existsSync(serverFile)) {
  throw new Error(
    "Artefato standalone ausente. Execute `pnpm build:web` antes de continuar.",
  );
}

const assets = [
  {
    source: resolve(webRoot, "public"),
    target: resolve(serverRoot, "public"),
  },
  {
    source: resolve(webRoot, ".next", "static"),
    target: resolve(serverRoot, ".next", "static"),
  },
];

for (const { source, target } of assets) {
  if (!existsSync(source)) {
    throw new Error(`Diretório obrigatório ausente: ${source}`);
  }

  rmSync(target, { force: true, recursive: true });
  cpSync(source, target, { recursive: true });
}

console.log(`[OK] Artefato standalone preparado em ${serverRoot}`);

if (process.argv.includes("--start")) {
  parsePublicEnvironment(process.env);
  console.log("[OK] Contrato de ambiente público validado");

  const child = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
      PORT: process.env.PORT ?? "3000",
    },
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }

  child.once("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.once("exit", (code) => process.exit(code ?? 0));
}
