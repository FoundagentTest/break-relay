import type {
  ActiveSession,
  Feeling,
  RouteHistoryEntry,
  RouteMemory,
  RouteMemoryStep,
  RouteOutcome,
  SpaceMode,
} from "./types";

export const ROUTE_MEMORY_STORAGE_KEY = "break-relay-route-memory-v1";
export const MAX_ROUTE_HISTORY = 24;

const FEELINGS = new Set<Feeling>(["noise", "eyes", "stiff", "air"]);
const SPACE_MODES = new Set<SpaceMode>(["any", "small", "seated"]);
const OUTCOMES = new Set<RouteOutcome>(["useful", "not_fit", "unrated"]);

export function emptyRouteMemory(): RouteMemory {
  return { version: 1, entries: [] };
}

function safeString(value: unknown, maximum: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    ? value
    : null;
}

function migrateOutcome(value: unknown): RouteOutcome | null {
  if (OUTCOMES.has(value as RouteOutcome)) return value as RouteOutcome;
  if (value === "worked") return "useful";
  if (value === "did_not_fit") return "not_fit";
  if (value === null || value === undefined) return "unrated";
  return null;
}

function normalizeStep(
  value: unknown,
  legacySkippedIds: Set<string>,
): RouteMemoryStep | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Record<string, unknown>;
  const stepId = safeString(step.stepId ?? step.id, 160);
  const stationId = safeString(step.stationId, 160);
  const stationName = safeString(step.stationName ?? stationId, 80);
  const action = safeString(step.action, 600);
  if (!stepId || !stationId || !stationName || !action) return null;
  const skipped =
    typeof step.skipped === "boolean"
      ? step.skipped
      : legacySkippedIds.has(stepId);
  return {
    stepId,
    stationId,
    stationName,
    action,
    used: typeof step.used === "boolean" ? step.used : !skipped,
    skipped,
  };
}

function normalizeEntry(value: unknown): RouteHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const id = safeString(entry.id, 200);
  const feeling = entry.feeling as Feeling;
  const spaceMode = entry.spaceMode as SpaceMode;
  const durationMinutes = entry.durationMinutes ?? entry.duration;
  const completedAt = entry.completedAt;
  const outcome = migrateOutcome(entry.outcome);
  const skippedIds = new Set(
    Array.isArray(entry.skippedStepIds)
      ? entry.skippedStepIds.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );
  const steps = Array.isArray(entry.steps)
    ? entry.steps
        .slice(0, 8)
        .map((step) => normalizeStep(step, skippedIds))
        .filter((step): step is RouteMemoryStep => step !== null)
    : [];

  if (
    !id ||
    !FEELINGS.has(feeling) ||
    !SPACE_MODES.has(spaceMode) ||
    typeof durationMinutes !== "number" ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > 60 ||
    typeof completedAt !== "number" ||
    !Number.isFinite(completedAt) ||
    completedAt < 0 ||
    !outcome ||
    steps.length === 0
  ) {
    return null;
  }

  return {
    version: 1,
    id,
    feeling,
    durationMinutes,
    spaceMode,
    steps,
    extensionUsed:
      typeof entry.extensionUsed === "boolean" ? entry.extensionUsed : false,
    endedEarly: typeof entry.endedEarly === "boolean" ? entry.endedEarly : false,
    outcome,
    completedAt,
  };
}

function boundedEntries(entries: RouteHistoryEntry[]) {
  const byId = new Map<string, RouteHistoryEntry>();
  for (const entry of [...entries].sort(
    (a, b) => a.completedAt - b.completedAt,
  )) {
    byId.set(entry.id, entry);
  }
  return [...byId.values()]
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-MAX_ROUTE_HISTORY);
}

export function loadRouteMemory(): RouteMemory {
  try {
    const saved = window.localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY);
    if (!saved) return emptyRouteMemory();
    const parsed = JSON.parse(saved) as unknown;
    const candidateEntries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? Array.isArray((parsed as { entries?: unknown }).entries)
          ? (parsed as { entries: unknown[] }).entries
          : Array.isArray((parsed as { history?: unknown }).history)
            ? (parsed as { history: unknown[] }).history
            : null
        : null;
    if (!candidateEntries) {
      clearRouteMemory();
      return emptyRouteMemory();
    }
    const memory = {
      version: 1 as const,
      entries: boundedEntries(
        candidateEntries
          .map(normalizeEntry)
          .filter((entry): entry is RouteHistoryEntry => entry !== null),
      ),
    };
    saveRouteMemory(memory);
    return memory;
  } catch {
    clearRouteMemory();
    return emptyRouteMemory();
  }
}

export function saveRouteMemory(memory: RouteMemory) {
  try {
    const bounded: RouteMemory = {
      version: 1,
      entries: boundedEntries(memory.entries),
    };
    window.localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify(bounded),
    );
  } catch {
    // A blocked or full localStorage must never prevent a relay from returning.
  }
}

export function clearRouteMemory() {
  try {
    window.localStorage.removeItem(ROUTE_MEMORY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

export function appendRouteHistory(
  memory: RouteMemory,
  entry: RouteHistoryEntry,
): RouteMemory {
  return {
    version: 1,
    entries: boundedEntries([
      ...memory.entries.filter((item) => item.id !== entry.id),
      entry,
    ]),
  };
}

export function createRouteHistoryEntry(
  session: ActiveSession,
  fallback: {
    feeling: Feeling;
    spaceMode: SpaceMode;
  },
  outcome: RouteOutcome,
  completedAt = Date.now(),
): RouteHistoryEntry | null {
  const context = session.routeContext;
  const sourceSteps =
    context?.steps ??
    session.route
      .filter((step) => step.kind === "station")
      .map((step) => ({
        stepId: step.id,
        stationId: step.station.id,
        stationName: step.station.name,
        action: step.action,
      }));
  if (sourceSteps.length === 0) return null;
  const skippedIds = new Set(session.skippedStepIds);
  const reachedIds = new Set(session.reachedStepIds);
  return {
    version: 1,
    id: session.id,
    feeling: context?.feeling ?? fallback.feeling,
    durationMinutes: session.durationMinutes,
    spaceMode: context?.spaceMode ?? fallback.spaceMode,
    steps: sourceSteps.map((step) => ({
      ...step,
      used: reachedIds.has(step.stepId) && !skippedIds.has(step.stepId),
      skipped: skippedIds.has(step.stepId),
    })),
    extensionUsed: session.extensionUsed,
    endedEarly: session.endedEarly,
    outcome,
    completedAt,
  };
}
