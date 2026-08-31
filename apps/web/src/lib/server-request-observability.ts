export type ServerRequestTelemetry = {
  digest: string | null;
  errorName: string;
  event: "orbiq.server.request_cancelled" | "orbiq.server.request_error";
  level: "error" | "info";
};

const SAFE_DIGEST = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;

function digestFrom(error: unknown): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("digest" in error) ||
    typeof error.digest !== "string"
  ) {
    return null;
  }

  return SAFE_DIGEST.test(error.digest) ? error.digest : null;
}

function errorNameFrom(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }

  return SAFE_ERROR_NAME.test(error.name) ? error.name : "Error";
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
    errorName: errorNameFrom(error),
    event: expectedCancellation
      ? "orbiq.server.request_cancelled"
      : "orbiq.server.request_error",
    level: expectedCancellation ? "info" : "error",
  };
}
