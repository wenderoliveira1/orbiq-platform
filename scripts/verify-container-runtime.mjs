import { readFile } from "node:fs/promises";

const dockerfile = await readFile("Dockerfile", "utf8");
const runnerMarker = "FROM node:22.23.2-alpine AS runner";
const runnerStart = dockerfile.indexOf(runnerMarker);

if (runnerStart === -1) {
  throw new Error("Dockerfile: final runner image contract changed");
}

const runnerStage = dockerfile.slice(runnerStart);
const requiredRuntimeContracts = [
  {
    label: "non-root runtime user",
    value: "USER nextjs",
  },
  {
    label: "non-root ownership on runtime files",
    value:
      "COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./",
  },
  {
    label: "production runtime mode",
    value: 'ENV NODE_ENV="production"',
  },
  {
    label: "readiness health check",
    value:
      "CMD wget -q -O /dev/null http://127.0.0.1:3000/api/ready || exit 1",
  },
  {
    label: "explicit graceful stop signal",
    value: "STOPSIGNAL SIGTERM",
  },
  {
    label: "exec-form server command",
    value: 'CMD ["node", "apps/web/server.js"]',
  },
];

for (const contract of requiredRuntimeContracts) {
  if (!runnerStage.includes(contract.value)) {
    throw new Error(
      `Dockerfile: missing container runtime contract: ${contract.label}`,
    );
  }
}

if (/^USER\s+root\s*$/m.test(runnerStage)) {
  throw new Error("Dockerfile: final runtime stage cannot switch back to root");
}

if (/^RUN\s+(?:apk|apt-get|apt|yum|dnf)\s+/m.test(runnerStage)) {
  throw new Error(
    "Dockerfile: final runtime stage cannot install operating-system packages",
  );
}

if (
  /^(?:ARG|ENV)\s+[^\n]*(?:SERVICE_ROLE|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)/im.test(
    dockerfile,
  )
) {
  throw new Error(
    "Dockerfile: sensitive credentials cannot be declared as build arguments or environment variables",
  );
}

const userPosition = runnerStage.indexOf("USER nextjs");
const stopSignalPosition = runnerStage.indexOf("STOPSIGNAL SIGTERM");
const commandPosition = runnerStage.indexOf('CMD ["node", "apps/web/server.js"]');

if (userPosition === -1 || userPosition > commandPosition) {
  throw new Error("Dockerfile: runtime must drop privileges before startup");
}

if (stopSignalPosition === -1 || stopSignalPosition > commandPosition) {
  throw new Error("Dockerfile: graceful stop signal must be declared before startup");
}

console.log("Container runtime security contract verified.");
