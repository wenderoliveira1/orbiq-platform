export type OrbiqReleaseChannel =
  | "local"
  | "ci"
  | "preview"
  | "production";

export type OrbiqReleaseInfo = {
  channel: OrbiqReleaseChannel;
  commit: string;
  release: string;
  service: "orbiq-web";
  version: string;
};

const APP_VERSION = "0.1.0";
const SAFE_RELEASE_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
const SAFE_COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;

function safeCommit(value: string | undefined) {
  const normalized = value?.trim() ?? "";

  if (!SAFE_COMMIT_PATTERN.test(normalized)) {
    return "local";
  }

  return normalized.slice(0, 12).toLowerCase();
}

function safeRelease(value: string | undefined, commit: string) {
  const normalized = value?.trim() ?? "";

  if (SAFE_RELEASE_PATTERN.test(normalized)) {
    return normalized;
  }

  return commit === "local" ? `orbiq-${APP_VERSION}-local` : `orbiq-${commit}`;
}

function releaseChannel(): OrbiqReleaseChannel {
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();

  if (vercelEnvironment === "production") {
    return "production";
  }

  if (vercelEnvironment === "preview") {
    return "preview";
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    return "ci";
  }

  return "local";
}

export function getReleaseInfo(): OrbiqReleaseInfo {
  const commit = safeCommit(
    process.env.ORBIQ_RELEASE_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GITHUB_SHA,
  );

  return {
    channel: releaseChannel(),
    commit,
    release: safeRelease(process.env.ORBIQ_RELEASE_ID, commit),
    service: "orbiq-web",
    version: APP_VERSION,
  };
}
