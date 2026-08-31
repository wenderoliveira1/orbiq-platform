export type ServerRequestTelemetry = {
  digest: string | null;
  errorName: string;
  event: "orbiq.server.request_cancelled" | "orbiq.server.request_error";
  level: "error" | "info";
};

function digestFrom(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
  ) {
    return error.digest;
  }

  return null;
}

function isExpectedStreamCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === "The destination stream closed early."
  );
}

export function classifyServerRequestError(
  error: unknown,
): ServerRequestTelemetry {
  const expectedCancellation = isExpectedStreamCancellation(error);

  return {
    digest: digestFrom(error),
    errorName: error instanceof Error ? error.name : typeof error,
    event: expectedCancellation
      ? "orbiq.server.request_cancelled"
      : "orbiq.server.request_error",
    level: expectedCancellation ? "info" : "error",
  };
}
