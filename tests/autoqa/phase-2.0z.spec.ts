import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { classifyServerRequestError } from "../../apps/web/src/lib/server-request-observability";

test.describe("Fase 2.0Z - observabilidade de cancelamentos", () => {
  test("classifica somente o encerramento conhecido de stream como cancelamento", () => {
    expect(
      classifyServerRequestError(
        new Error("The destination stream closed early."),
      ),
    ).toEqual({
      digest: null,
      errorName: "Error",
      event: "orbiq.server.request_cancelled",
      level: "info",
    });

    expect(
      classifyServerRequestError(new Error("database connection failed")),
    ).toEqual({
      digest: null,
      errorName: "Error",
      event: "orbiq.server.request_error",
      level: "error",
    });
  });

  test("preserva digest de erro real sem registrar a mensagem", async () => {
    const source = await readFile("apps/web/src/instrumentation.ts", "utf8");
    const error = Object.assign(new Error("customer@example.com"), {
      digest: "stable-digest",
    });

    expect(classifyServerRequestError(error)).toEqual({
      digest: "stable-digest",
      errorName: "Error",
      event: "orbiq.server.request_error",
      level: "error",
    });
    expect(source).toContain("classifyServerRequestError");
    expect(source).toContain('telemetry.level === "info" ? console.info : console.error');
    expect(source).not.toContain("error.message");
  });
});
