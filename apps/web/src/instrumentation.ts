import type { Instrumentation } from "next";

import { getPublicEnvironment } from "@/lib/public-environment";
import { classifyServerRequestError } from "@/lib/server-request-observability";

export function register() {
  getPublicEnvironment();
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
  const telemetry = classifyServerRequestError(error);
  const log = telemetry.level === "info" ? console.info : console.error;

  log(
    JSON.stringify({
      digest: telemetry.digest,
      errorName: telemetry.errorName,
      event: telemetry.event,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
    }),
  );
};
