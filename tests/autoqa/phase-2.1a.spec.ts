import { expect, test } from "@playwright/test";

import { classifyServerRequestError } from "../../apps/web/src/lib/server-request-observability";

test.describe("Fase 2.1A - sanitização de telemetria do servidor", () => {
  test("preserva somente digest e nome de erro com formato seguro", () => {
    const error = Object.assign(new Error("mensagem interna"), {
      digest: "next.digest-123:abc",
    });
    error.name = "DatabaseError";

    expect(classifyServerRequestError(error)).toEqual({
      digest: "next.digest-123:abc",
      errorName: "DatabaseError",
      event: "orbiq.server.request_error",
      level: "error",
    });
  });

  test("descarta campos arbitrários, multiline ou excessivos antes dos logs", () => {
    const error = Object.assign(new Error("cliente@example.com"), {
      digest: "customer@example.com\nAuthorization: bearer secret",
    });
    error.name = `Injected\n${"x".repeat(100)}`;

    expect(classifyServerRequestError(error)).toEqual({
      digest: null,
      errorName: "Error",
      event: "orbiq.server.request_error",
      level: "error",
    });
  });
});
