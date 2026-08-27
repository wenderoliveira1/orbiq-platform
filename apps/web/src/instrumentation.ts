import type { Instrumentation } from "next";

import { getPublicEnvironment } from "@/lib/public-environment";

export function register() {
  getPublicEnvironment();
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : null;

  const errorName = error instanceof Error ? error.name : typeof error;

  console.error(
    JSON.stringify({
      digest,
      errorName,
      event: "orbiq.server.request_error",
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
    }),
  );
};
