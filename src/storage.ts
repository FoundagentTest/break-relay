import {
  DEFAULT_PREFERENCES,
  stationsForSpaceMode,
} from "./data";
import { getRelayCapabilities } from "./capabilities";
import { reconcileSession } from "./session";
import type {
  ActiveSession,
  Feeling,
  LaunchCapabilitySnapshot,
  Preferences,
  RouteStep,
  SessionRouteContext,
  SpaceMode,
  Station,
} from "./types";

export const STORAGE_KEY = "break-relay-preferences-v1";
export const SESSION_STORAGE_KEY = "break-relay-active-session-v1";

function normalizeStation(value: unknown): Station | null {
  if (!value || typeof value !== "object") return null;
  const station = value as Partial<Station>;
  const modes = Array.isArray(station.modes)
    ? station.modes.filter(
        (mode): mode is SpaceMode =>
          mode === "any" || mode === "small" || mode === "seated",
      )
    : [];
  if (
    typeof station.id !== "string" ||
    !station.id ||
    typeof station.name !== "string" ||
    !station.name ||
    typeof station.kind !== "string" ||
    typeof station.detail !== "string" ||
    modes.length === 0
  ) {
    return null;
  }
  return { ...station, modes } as Station;
}

export function loadPreferences(): Preferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<Preferences>;
    const spaceMode: SpaceMode = ["any", "small", "seated"].includes(
      parsed.spaceMode ?? "",
    )
      ? (parsed.spaceMode as SpaceMode)
      : DEFAULT_PREFERENCES.spaceMode;
    const savedStations = Array.isArray(parsed.stations)
      ? parsed.stations
          .map(normalizeStation)
          .filter((station): station is Station => station !== null)
          .filter(
            (station, index, stations) =>
              stations.findIndex((item) => item.id === station.id) === index,
          )
          .slice(0, 24)
      : [];
    const legacyLaunchPreferences =
      typeof parsed.launchSetupComplete !== "boolean";
    const currentCapabilities = getRelayCapabilities();
    const savedSnapshot = parsed.capabilitySnapshot;
    const capabilitySnapshot: LaunchCapabilitySnapshot | null =
      savedSnapshot &&
      typeof savedSnapshot.speech === "boolean" &&
      typeof savedSnapshot.wakeLock === "boolean"
        ? savedSnapshot
        : legacyLaunchPreferences && parsed.hasOnboarded
          ? {
              // The previous launch gate only persisted spoken mode after its
              // voice check. Preserve that evidence so a now-missing speech
              // capability is treated as a change instead of silently trusted.
              speech:
                parsed.audioEnabled === true
                  ? true
                  : currentCapabilities.speech,
              wakeLock: currentCapabilities.wakeLock,
            }
          : null;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      spaceMode,
      stations: savedStations,
      keepAwake:
        typeof parsed.keepAwake === "boolean" ? parsed.keepAwake : false,
      alwaysReviewLaunch:
        typeof parsed.alwaysReviewLaunch === "boolean"
          ? parsed.alwaysReviewLaunch
          : false,
      launchSetupComplete:
        typeof parsed.launchSetupComplete === "boolean"
          ? parsed.launchSetupComplete
          : parsed.hasOnboarded === true,
      launchNeedsReview:
        typeof parsed.launchNeedsReview === "boolean"
          ? parsed.launchNeedsReview
          : false,
      capabilitySnapshot,
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

function normalizeRouteStep(value: unknown): RouteStep | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Partial<RouteStep> & { kind?: string };
  const legacyPhase =
    step.kind === "station"
      ? "arrive"
      : step.kind === "return"
        ? "return"
        : step.kind === "extension"
          ? "extension"
          : null;
  const phase = [
    "move",
    "arrive",
    "quiet",
    "settle",
    "return",
    "extension",
  ].includes(step.phase ?? "")
    ? step.phase
    : legacyPhase;
  const valid =
    typeof step.id === "string" &&
    typeof step.action === "string" &&
    typeof step.spokenCue === "string" &&
    typeof step.durationSeconds === "number" &&
    step.durationSeconds > 0 &&
    !!step.station &&
    typeof step.station.name === "string" &&
    phase !== null;
  if (!valid) return null;
  return {
    id: step.id as string,
    station: step.station as RouteStep["station"],
    action: step.action as string,
    spokenCue: step.spokenCue as string,
    durationSeconds: step.durationSeconds as number,
    phase: phase as RouteStep["phase"],
  };
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

function normalizeSession(
  value: unknown,
  fallbackStations: Station[],
  fallbackSpaceMode: SpaceMode,
): ActiveSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Omit<Partial<ActiveSession>, "version"> & {
    version?: number;
  };
  const normalizedRoute = Array.isArray(session.route)
    ? session.route.map(normalizeRouteStep)
    : [];
  const valid =
    (session.version === 1 ||
      session.version === 2 ||
      session.version === 3 ||
      session.version === 4 ||
      session.version === 5) &&
    typeof session.id === "string" &&
    normalizedRoute.length > 0 &&
    normalizedRoute.every(
      (step): step is RouteStep => step !== null,
    ) &&
    typeof session.startedAt === "number" &&
    typeof session.stepDeadlineAt === "number" &&
    typeof session.deadlineAt === "number" &&
    typeof session.currentStepIndex === "number" &&
    session.currentStepIndex >= 0 &&
    session.currentStepIndex < normalizedRoute.length &&
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
  const route = normalizedRoute as RouteStep[];
  const routeContext = normalizeRouteContext(session.routeContext);
  const routeIds = new Set([
    ...route.map((step) => step.id),
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
    : route
        .slice(0, (session.currentStepIndex ?? 0) + 1)
        .filter(
          (step) =>
            step.phase === "arrive" ||
            (step.phase === "quiet" &&
              step.station.id !== "comfortable-pause"),
        )
        .map((step) => step.id);
  const neutralStepIds = Array.isArray(session.neutralStepIds)
    ? session.neutralStepIds.filter(
        (id): id is string => typeof id === "string" && routeIds.has(id),
      )
    : [];
  const storedEligibleStations = Array.isArray(session.eligibleStations)
    ? session.eligibleStations
        .map(normalizeStation)
        .filter((station): station is Station => station !== null)
    : null;
  const eligibleStations =
    storedEligibleStations ??
    stationsForSpaceMode(
      fallbackStations,
      routeContext?.spaceMode ?? fallbackSpaceMode,
    );
  const unavailableStationIds = Array.isArray(
    session.unavailableStationIds,
  )
    ? session.unavailableStationIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  return {
    ...(session as Omit<
      ActiveSession,
      | "version"
      | "routeContext"
      | "skippedStepIds"
      | "reachedStepIds"
      | "neutralStepIds"
      | "eligibleStations"
      | "unavailableStationIds"
      | "rerouteCount"
      | "cueDeliveryFailed"
      | "wakeLockFailed"
    >),
    version: 5,
    route,
    routeContext,
    skippedStepIds,
    reachedStepIds,
    neutralStepIds,
    eligibleStations,
    unavailableStationIds,
    rerouteCount:
      typeof session.rerouteCount === "number" &&
      Number.isInteger(session.rerouteCount) &&
      session.rerouteCount >= 0
        ? session.rerouteCount
        : 0,
    cueDeliveryFailed:
      typeof session.cueDeliveryFailed === "boolean"
        ? session.cueDeliveryFailed
        : false,
    wakeLockFailed:
      typeof session.wakeLockFailed === "boolean"
        ? session.wakeLockFailed
        : false,
  };
}

export function loadSession(now = Date.now()): ActiveSession | null {
  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    const preferences = loadPreferences();
    const parsed = normalizeSession(
      JSON.parse(saved) as unknown,
      preferences.stations,
      preferences.spaceMode,
    );
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
