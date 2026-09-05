import { expect, test } from "@playwright/test";
import {
  appendPwaUpdateTelemetry,
  createPwaUpdateTelemetryEntry,
  serializePwaUpdateTelemetry,
  summarizePwaUpdateTelemetry,
} from "../../apps/web/src/lib/pwa-update-telemetry";

test.describe("Fase 2.1AV - telemetria local segura do update PWA", () => {
  test("valida payload mínimo e limita tentativas", () => {
    const entry = createPwaUpdateTelemetryEntry({
      event: "update_detected",
      source: "startup",
      timestamp: "2026-09-05T10:00:00Z",
      attempt: 2,
    });

    expect(entry).toEqual({
      event: "update_detected",
      source: "startup",
      timestamp: "2026-09-05T10:00:00.000Z",
      attempt: 2,
    });
    expect(() =>
      createPwaUpdateTelemetryEntry({
        event: "update_failed",
        source: "manual",
        attempt: 4,
      }),
    ).toThrow();
  });

  test("mantém buffer bounded e resumo seguro", () => {
    const entries = Array.from({ length: 25 }, (_, index) =>
      createPwaUpdateTelemetryEntry({
        event: index === 24 ? "update_activated" : "update_detected",
        source: "interval",
        timestamp: `2026-09-05T10:${String(index).padStart(2, "0")}:00Z`,
        attempt: Math.min(index % 4, 3),
      }),
    );

    let buffer: typeof entries = [];
    for (const entry of entries) {
      buffer = appendPwaUpdateTelemetry(buffer, entry);
    }

    expect(buffer).toHaveLength(20);
    expect(summarizePwaUpdateTelemetry(buffer)).toEqual({
      count: 20,
      lastEvent: "update_activated",
      lastAttempt: 0,
    });
  });

  test("serializa somente o contrato público local", () => {
    const entry = createPwaUpdateTelemetryEntry({
      event: "update_failed",
      source: "online",
      timestamp: "2026-09-05T10:00:00Z",
      attempt: 3,
    });
    const serialized = serializePwaUpdateTelemetry([entry]);

    expect(serialized).toContain("update_failed");
    expect(serialized).toContain("online");
    expect(serialized).not.toMatch(/email|organization|customer|vehicle|plate|quote|token|cookie|url/i);
  });
});
