export const PWA_UPDATE_EVENTS = [
  "update_detected",
  "update_deferred",
  "update_requested",
  "update_activated",
  "update_failed",
] as const;

export const PWA_UPDATE_SOURCES = [
  "startup",
  "visibility",
  "online",
  "interval",
  "manual",
] as const;

export type PwaUpdateEvent = (typeof PWA_UPDATE_EVENTS)[number];
export type PwaUpdateSource = (typeof PWA_UPDATE_SOURCES)[number];

export type PwaUpdateTelemetryEntry = {
  event: PwaUpdateEvent;
  source: PwaUpdateSource;
  timestamp: string;
  attempt: number;
};

const MAX_ENTRIES = 20;
const MAX_ATTEMPT = 3;

export function createPwaUpdateTelemetryEntry(input: {
  event: PwaUpdateEvent;
  source: PwaUpdateSource;
  timestamp?: string;
  attempt?: number;
}): PwaUpdateTelemetryEntry {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const parsedTime = Date.parse(timestamp);

  if (!Number.isFinite(parsedTime)) {
    throw new Error("timestamp inválido");
  }

  const attempt = Math.trunc(input.attempt ?? 0);
  if (attempt < 0 || attempt > MAX_ATTEMPT) {
    throw new Error("attempt fora do intervalo permitido");
  }

  return {
    event: input.event,
    source: input.source,
    timestamp: new Date(parsedTime).toISOString(),
    attempt,
  };
}

export function appendPwaUpdateTelemetry(
  current: readonly PwaUpdateTelemetryEntry[],
  entry: PwaUpdateTelemetryEntry,
): PwaUpdateTelemetryEntry[] {
  return [...current, entry].slice(-MAX_ENTRIES);
}

export function summarizePwaUpdateTelemetry(
  entries: readonly PwaUpdateTelemetryEntry[],
): { count: number; lastEvent: PwaUpdateEvent | null; lastAttempt: number } {
  const last = entries.at(-1);

  return {
    count: entries.length,
    lastEvent: last?.event ?? null,
    lastAttempt: last?.attempt ?? 0,
  };
}

export function serializePwaUpdateTelemetry(
  entries: readonly PwaUpdateTelemetryEntry[],
): string {
  return JSON.stringify(entries.slice(-MAX_ENTRIES));
}
