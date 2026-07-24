import { DEFAULT_PREFERENCES } from "./data";
import { reconcileSession } from "./session";
import type {
  ActiveSession,
  Feeling,
  Preferences,
  RouteStep,
  SessionRouteContext,
  SpaceMode,
} from "./types";

export const STORAGE_KEY = "break-relay-preferences-v1";
export const SESSION_STORAGE_KEY = "break-relay-active-session-v1";

export function loadPreferences(): Preferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      stations: Array.isArray(parsed.stations) ? parsed.stations : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function clearPreferences() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function isRouteStep(value: unknown): value is RouteStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Partial<RouteStep>;
  return (
    typeof step.id === "string" &&
    typeof step.action === "string" &&
    typeof step.spokenCue === "string" &&
    typeof step.durationSeconds === "number" &&
    step.durationSeconds > 0 &&
    !!step.station &&
    typeof step.station.name === "string" &&
    ["station", "return", "extension"].includes(step.kind ?? "")
  );
}

function normalizeRouteContext(value: unknown): SessionRouteContext | null {
  if (!value || typeof value !== "object") return null;
  const context = value as Partial<SessionRouteContext>;
  const feelings: Feeling[] = ["noise", "eyes", "stiff", "air"];
  const modes: SpaceMode[] = ["any", "small", "seated"];
  if (
    !feelings.includes(context.feeling as Feeling) ||
    !modes.includes(context.spaceMode as SpaceMode) ||
    !Array.isArray(context.steps) ||
    context.steps.length === 0 ||
    !context.steps.every(
      (step) =>
        !!step &&
        typeof step.stepId === "string" &&
        typeof step.stationId === "string" &&
        typeof step.stationName === "string" &&
        typeof step.action === "string",
    )
  ) {
    return null;
  }
  return {
    feeling: context.feeling as Feeling,
    spaceMode: context.spaceMode as SpaceMode,
    steps: context.steps.map((step) => ({
      stepId: step.stepId,
      stationId: step.stationId,
      stationName: step.stationName,
      action: step.action,
    })),
  };
}

function normalizeSession(value: unknown): ActiveSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Omit<Partial<ActiveSession>, "version"> & {
    version?: number;
  };
  const valid =
    (session.version === 1 || session.version === 2) &&
    typeof session.id === "string" &&
    Array.isArray(session.route) &&
    session.route.length > 0 &&
    session.route.every(isRouteStep) &&
    typeof session.startedAt === "number" &&
    typeof session.stepDeadlineAt === "number" &&
    typeof session.deadlineAt === "number" &&
    typeof session.currentStepIndex === "number" &&
    session.currentStepIndex >= 0 &&
    session.currentStepIndex < session.route.length &&
    typeof session.paused === "boolean" &&
    (session.pausedAt === null || typeof session.pausedAt === "number") &&
    (session.status === "active" || session.status === "complete") &&
    typeof session.endedEarly === "boolean" &&
    typeof session.extensionUsed === "boolean" &&
    typeof session.audioEnabled === "boolean" &&
    typeof session.keepAwake === "boolean" &&
    typeof session.durationMinutes === "number" &&
    (session.completedAt === null || typeof session.completedAt === "number") &&
    (session.lastAnnouncedStepId === null ||
      typeof session.lastAnnouncedStepId === "string") &&
    typeof session.updatedAt === "number";
  if (!valid) return null;
  const routeContext = normalizeRouteContext(session.routeContext);
  const routeIds = new Set([
    ...(session.route?.map((step) => step.id) ?? []),
    ...(routeContext?.steps.map((step) => step.stepId) ?? []),
  ]);
  const skippedStepIds = Array.isArray(session.skippedStepIds)
    ? session.skippedStepIds.filter(
        (id): id is string => typeof id === "string" && routeIds.has(id),
      )
    : [];
  const reachedStepIds = Array.isArray(session.reachedStepIds)
    ? session.reachedStepIds.filter(
        (id): id is string => typeof id === "string" && routeIds.has(id),
      )
    : (session.route ?? [])
        .slice(0, (session.currentStepIndex ?? 0) + 1)
        .filter((step) => step.kind === "station")
        .map((step) => step.id);
  return {
    ...(session as Omit<
      ActiveSession,
      "version" | "routeContext" | "skippedStepIds" | "reachedStepIds"
    >),
    version: 2,
    routeContext,
    skippedStepIds,
    reachedStepIds,
  };
}

export function loadSession(now = Date.now()): ActiveSession | null {
  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    const parsed = normalizeSession(JSON.parse(saved) as unknown);
    if (!parsed) {
      clearSession();
      return null;
    }
    const reconciled = reconcileSession(parsed, now);
    if (reconciled !== parsed) saveSession(reconciled);
    return reconciled;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: ActiveSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
