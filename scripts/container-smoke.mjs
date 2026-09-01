import { spawnSync } from "node:child_process";

const root = process.cwd();
const imageTag = `orbiq-ci:${(process.env.GITHUB_SHA ?? "local")
  .slice(0, 12)
  .toLowerCase()}`;
const containerName = `orbiq-ci-${process.pid}`;
const syntheticPublishableKey =
  "sb_publishable_ci_smoke_test_00000000000000000000";

let imageBuilt = false;
let containerStarted = false;

function execute(command, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      DOCKER_BUILDKIT: "1",
    },
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}`);
  }

  return result;
}

function captured(command, args) {
  return execute(command, args, { capture: true }).stdout.trim();
}

async function waitForReadiness() {
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/ready", {
        cache: "no-store",
      });
      const body = await response.json();

      if (
        response.ok &&
        body?.service === "orbiq-web" &&
        body?.status === "ready"
      ) {
        return;
      }
    } catch {
      // The standalone server can still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  const state = captured("docker", [
    "inspect",
    "--format",
    "{{.State.Status}}",
    containerName,
  ]);

  throw new Error(
    `Production container did not become ready within 45 seconds (state: ${state})`,
  );
}

async function waitForNativeHealth() {
  let lastStatus = "missing";

  for (let attempt = 1; attempt <= 75; attempt += 1) {
    lastStatus = captured("docker", [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}",
      containerName,
    ]);

    if (lastStatus === "healthy") {
      return;
    }

    if (lastStatus === "unhealthy") {
      throw new Error("Production container native healthcheck became unhealthy");
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `Production container native healthcheck did not become healthy (last status: ${lastStatus})`,
  );
}

try {
  const dockerVersion = captured("docker", [
    "version",
    "--format",
    "{{.Server.Version}}",
  ]);
  console.log(`Docker server ${dockerVersion} available.`);

  execute("docker", [
    "build",
    "--build-arg",
    "NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000",
    "--build-arg",
    "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
    "--build-arg",
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${syntheticPublishableKey}`,
    "--tag",
    imageTag,
    ".",
  ]);
  imageBuilt = true;

  const imageSizeBytes = Number(
    captured("docker", [
      "image",
      "inspect",
      "--format",
      "{{.Size}}",
      imageTag,
    ]),
  );
  const maximumImageSizeBytes = 400 * 1024 * 1024;

  if (!Number.isFinite(imageSizeBytes) || imageSizeBytes <= 0) {
    throw new Error("Production image size could not be determined");
  }

  if (imageSizeBytes > maximumImageSizeBytes) {
    throw new Error(
      `Production image exceeds 400 MiB budget (${(imageSizeBytes / 1024 / 1024).toFixed(1)} MiB)`,
    );
  }

  console.log(
    `Production image size ${(imageSizeBytes / 1024 / 1024).toFixed(1)} MiB is within the 400 MiB budget.`,
  );

  const runtimeUser = captured("docker", [
    "image",
    "inspect",
    "--format",
    "{{.Config.User}}",
    imageTag,
  ]);
  if (runtimeUser !== "nextjs") {
    throw new Error(`Production image runs as unexpected user: ${runtimeUser}`);
  }

  const runtimeCommand = captured("docker", [
    "image",
    "inspect",
    "--format",
    "{{json .Config.Cmd}}",
    imageTag,
  ]);
  if (runtimeCommand !== '["node","apps/web/server.js"]') {
    throw new Error(
      `Production image has unexpected startup command: ${runtimeCommand}`,
    );
  }

  execute(
    "docker",
    [
      "run",
      "--detach",
      "--name",
      containerName,
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--memory",
      "512m",
      "--pids-limit",
      "128",
      "--cpus",
      "1.0",
      "--network",
      "host",
      imageTag,
    ],
    { capture: true },
  );
  containerStarted = true;

  const hostConfig = JSON.parse(
    captured("docker", [
      "inspect",
      "--format",
      "{{json .HostConfig}}",
      containerName,
    ]),
  );

  if (hostConfig.ReadonlyRootfs !== true) {
    throw new Error("Production container root filesystem must be read-only");
  }

  if (!hostConfig.CapDrop?.includes("ALL")) {
    throw new Error("Production container must drop all Linux capabilities");
  }

  if (!hostConfig.SecurityOpt?.includes("no-new-privileges=true")) {
    throw new Error("Production container must prevent privilege escalation");
  }

  if (hostConfig.Memory !== 512 * 1024 * 1024) {
    throw new Error("Production container memory limit must be 512 MiB");
  }

  if (hostConfig.PidsLimit !== 128) {
    throw new Error("Production container PID limit must be 128");
  }

  if (hostConfig.NanoCpus !== 1_000_000_000) {
    throw new Error("Production container CPU limit must be 1 core");
  }

  const temporaryFilesystem = hostConfig.Tmpfs?.["/tmp"] ?? "";
  if (
    !temporaryFilesystem.includes("noexec") ||
    !temporaryFilesystem.includes("nosuid")
  ) {
    throw new Error("Production container /tmp must be an isolated tmpfs");
  }

  await waitForReadiness();
  await waitForNativeHealth();

  const stopStartedAt = Date.now();
  execute("docker", ["stop", "--time", "10", containerName], {
    capture: true,
  });
  const stopElapsedMs = Date.now() - stopStartedAt;

  const stoppedState = JSON.parse(
    captured("docker", [
      "inspect",
      "--format",
      "{{json .State}}",
      containerName,
    ]),
  );

  if (stoppedState.Status !== "exited") {
    throw new Error(
      `Production container did not stop cleanly (state: ${stoppedState.Status})`,
    );
  }

  const expectedExitCodes = new Set([0, 143]);
  if (!expectedExitCodes.has(stoppedState.ExitCode)) {
    throw new Error(
      `Production container exited with unexpected code ${stoppedState.ExitCode}`,
    );
  }

  if (stoppedState.OOMKilled === true) {
    throw new Error("Production container was OOM-killed during lifecycle smoke");
  }

  if (stopElapsedMs > 12_000) {
    throw new Error(
      `Production container exceeded graceful shutdown budget (${stopElapsedMs} ms)`,
    );
  }

  console.log(
    `Hardened production container readiness, native health and normal SIGTERM shutdown verified in ${stopElapsedMs} ms (exit ${stoppedState.ExitCode}).`,
  );
} finally {
  if (containerStarted) {
    execute("docker", ["rm", "--force", containerName], {
      capture: true,
      allowFailure: true,
    });
  }

  if (imageBuilt) {
    execute("docker", ["image", "rm", "--force", imageTag], {
      capture: true,
      allowFailure: true,
    });
  }
}
