import {
  DEFAULT_PREFERENCES,
  stationsForSpaceMode,
} from "./data";
import { getRelayCapabilities } from "./capabilities";
import { reconcileSession } from "./session";
import { isLearnableRouteStep } from "./routeMemory";
import {
  DEFAULT_SPACE_ID,
  DEFAULT_SPACE_NAME,
  activeRelaySpace,
  initialRelaySpace,
} from "./spaces";
import type {
  ActiveSession,
  Feeling,
  LaunchCapabilitySnapshot,
  Preferences,
  RelaySpace,
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
  const presetId =
    typeof station.presetId === "string" && station.presetId
      ? station.presetId
      : undefined;
  return {
    ...station,
    modes,
    ...(presetId ? { presetId } : {}),
  } as Station;
}

function normalizeSpaceMode(value: unknown): SpaceMode {
  return value === "any" || value === "small" || value === "seated"
    ? value
    : "any";
}

function safeSpaceName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, 28);
  return clean.length >= 2 ? clean : fallback;
}

function uniqueId(base: string, used: Set<string>) {
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}:${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function normalizeSpaces(
  parsed: Record<string, unknown>,
): RelaySpace[] {
  const rawSpaces = Array.isArray(parsed.spaces) ? parsed.spaces : null;
  if (!rawSpaces) {
    const legacyStations = Array.isArray(parsed.stations)
      ? parsed.stations
          .map(normalizeStation)
          .filter((station): station is Station => station !== null)
          .filter(
            (station, index, stations) =>
              stations.findIndex((item) => item.id === station.id) === index,
          )
          .slice(0, 24)
      : [];
    return [
      {
        id: DEFAULT_SPACE_ID,
        name: DEFAULT_SPACE_NAME,
        stations: legacyStations,
        spaceMode: normalizeSpaceMode(parsed.spaceMode),
      },
    ];
  }

  const usedSpaceIds = new Set<string>();
  const usedStationIds = new Set<string>();
  const spaces: RelaySpace[] = [];
  for (const [index, value] of rawSpaces.slice(0, 6).entries()) {
    if (!value || typeof value !== "object") continue;
    const raw = value as Record<string, unknown>;
    const requestedId =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim().slice(0, 120)
        : `space-recovered-${index + 1}`;
    const id = uniqueId(requestedId, usedSpaceIds);
    const stations: Station[] = [];
    if (Array.isArray(raw.stations)) {
      for (const candidate of raw.stations.slice(0, 24)) {
        const normalized = normalizeStation(candidate);
        if (!normalized) continue;
        const stationId = uniqueId(
          usedStationIds.has(normalized.id)
            ? `${id}:${normalized.presetId ?? normalized.id}`
            : normalized.id,
          usedStationIds,
        );
        if (stations.some((station) => station.id === stationId)) continue;
        stations.push({
          ...normalized,
          id: stationId,
          ...(stationId !== normalized.id &&
          !normalized.custom &&
          !normalized.presetId
            ? { presetId: normalized.id }
            : {}),
        });
      }
    }
    spaces.push({
      id,
      name: safeSpaceName(raw.name, `Space ${index + 1}`),
      stations,
      spaceMode: normalizeSpaceMode(raw.spaceMode),
    });
  }
  return spaces.length > 0 ? spaces : [initialRelaySpace()];
}

export function loadPreferences(): Preferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      clearPreferences();
      return DEFAULT_PREFERENCES;
    }
    const spaces = normalizeSpaces(parsed);
    const activeSpaceId =
      typeof parsed.activeSpaceId === "string" &&
      spaces.some((space) => space.id === parsed.activeSpaceId)
        ? parsed.activeSpaceId
        : spaces[0].id;
    const legacyLaunchPreferences =
      typeof parsed.launchSetupComplete !== "boolean";
    const currentCapabilities = getRelayCapabilities();
    const savedSnapshot = parsed.capabilitySnapshot;
    const savedSnapshotRecord =
      savedSnapshot && typeof savedSnapshot === "object"
        ? (savedSnapshot as Record<string, unknown>)
        : null;
    const capabilitySnapshot: LaunchCapabilitySnapshot | null =
      savedSnapshotRecord &&
      typeof savedSnapshotRecord.speech === "boolean" &&
      typeof savedSnapshotRecord.wakeLock === "boolean"
        ? {
            speech: savedSnapshotRecord.speech,
            wakeLock: savedSnapshotRecord.wakeLock,
            ...(typeof savedSnapshotRecord.checkedAt === "number"
              ? { checkedAt: savedSnapshotRecord.checkedAt }
              : {}),
            ...(typeof savedSnapshotRecord.signature === "string"
              ? { signature: savedSnapshotRecord.signature }
              : {}),
            ...(typeof savedSnapshotRecord.chimeVerified === "boolean"
              ? { chimeVerified: savedSnapshotRecord.chimeVerified }
              : {}),
            ...(typeof savedSnapshotRecord.visualOnlyAcknowledged ===
            "boolean"
              ? {
                  visualOnlyAcknowledged:
                    savedSnapshotRecord.visualOnlyAcknowledged,
                }
              : {}),
            ...(typeof savedSnapshotRecord.speechVerified === "boolean"
              ? { speechVerified: savedSnapshotRecord.speechVerified }
              : {}),
            ...(typeof savedSnapshotRecord.wakeVerified === "boolean"
              ? { wakeVerified: savedSnapshotRecord.wakeVerified }
              : {}),
          }
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
      version: 2,
      spaces,
      activeSpaceId,
      feeling:
        parsed.feeling === "noise" ||
        parsed.feeling === "eyes" ||
        parsed.feeling === "stiff" ||
        parsed.feeling === "air"
          ? parsed.feeling
          : DEFAULT_PREFERENCES.feeling,
      duration:
        parsed.duration === 5 ||
        parsed.duration === 7 ||
        parsed.duration === 10
          ? parsed.duration
          : DEFAULT_PREFERENCES.duration,
      cueSoundEnabled:
        typeof parsed.cueSoundEnabled === "boolean"
          ? parsed.cueSoundEnabled
          : true,
      audioEnabled:
        typeof parsed.audioEnabled === "boolean"
          ? parsed.audioEnabled
          : DEFAULT_PREFERENCES.audioEnabled,
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
      hasOnboarded:
        typeof parsed.hasOnboarded === "boolean"
          ? parsed.hasOnboarded
          : false,
    };
  } catch {
    try {
      clearPreferences();
    } catch {
      // Storage itself can be unavailable; the in-memory default still works.
    }
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

function normalizeRouteContext(
  value: unknown,
  fallbackSpaceId: string,
): SessionRouteContext | null {
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
    spaceId:
      typeof context.spaceId === "string" && context.spaceId
        ? context.spaceId
        : fallbackSpaceId,
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

function normalizeSessionSpace(
  value: unknown,
  fallback: RelaySpace,
): RelaySpace {
  if (!value || typeof value !== "object") {
    return structuredClone(fallback);
  }
  const candidate = value as Partial<RelaySpace>;
  const stations = Array.isArray(candidate.stations)
    ? candidate.stations
        .map(normalizeStation)
        .filter((station): station is Station => station !== null)
        .filter(
          (station, index, items) =>
            items.findIndex((item) => item.id === station.id) === index,
        )
        .slice(0, 24)
    : [];
  return {
    id:
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : fallback.id,
    name: safeSpaceName(candidate.name, fallback.name),
    stations,
    spaceMode: normalizeSpaceMode(candidate.spaceMode),
  };
}

function normalizeSession(
  value: unknown,
  fallbackSpace: RelaySpace,
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
      session.version === 5 ||
      session.version === 6 ||
      session.version === 7) &&
    typeof session.id === "string" &&
    normalizedRoute.length > 0 &&
    normalizedRoute.every(
      (step): step is RouteStep => step !== null,
    ) &&
    typeof session.startedAt === "number" &&
    typeof session.stepDeadlineAt === "number" &&
    typeof session.deadlineAt === "number" &&
    (typeof session.originalDeadlineAt === "number" ||
      typeof session.originalDeadlineAt === "undefined") &&
    typeof session.currentStepIndex === "number" &&
    session.currentStepIndex >= 0 &&
    session.currentStepIndex < normalizedRoute.length &&
    typeof session.paused === "boolean" &&
    (session.pausedAt === null || typeof session.pausedAt === "number") &&
    (session.status === "active" || session.status === "complete") &&
    typeof session.endedEarly === "boolean" &&
    typeof session.extensionUsed === "boolean" &&
    (typeof session.cueSoundEnabled === "boolean" ||
      typeof session.cueSoundEnabled === "undefined") &&
    typeof session.audioEnabled === "boolean" &&
    typeof session.keepAwake === "boolean" &&
    typeof session.durationMinutes === "number" &&
    (session.completedAt === null || typeof session.completedAt === "number") &&
    (session.lastAnnouncedStepId === null ||
      typeof session.lastAnnouncedStepId === "string") &&
    typeof session.updatedAt === "number";
  if (!valid) return null;
  const route = normalizedRoute as RouteStep[];
  const spaceSnapshot = normalizeSessionSpace(
    session.spaceSnapshot,
    fallbackSpace,
  );
  const routeContext = normalizeRouteContext(
    session.routeContext,
    spaceSnapshot.id,
  );
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
        .filter(isLearnableRouteStep)
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
      spaceSnapshot.stations,
      routeContext?.spaceMode ?? spaceSnapshot.spaceMode,
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
      | "source"
      | "spaceSnapshot"
      | "routeContext"
      | "skippedStepIds"
      | "reachedStepIds"
      | "neutralStepIds"
      | "eligibleStations"
      | "unavailableStationIds"
      | "rerouteCount"
      | "originalDeadlineAt"
      | "cueSoundEnabled"
      | "cueDeliveryFailed"
      | "speechDeliveryFailed"
      | "wakeLockFailed"
      | "announcedCueIds"
    >),
    version: 7,
    source: session.source === "handoff" ? "handoff" : "local",
    spaceSnapshot,
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
    originalDeadlineAt:
      typeof session.originalDeadlineAt === "number"
        ? session.originalDeadlineAt
        : session.deadlineAt as number,
    cueSoundEnabled:
      typeof session.cueSoundEnabled === "boolean"
        ? session.cueSoundEnabled
        : true,
    cueDeliveryFailed:
      typeof session.cueDeliveryFailed === "boolean"
        ? session.cueDeliveryFailed
        : false,
    speechDeliveryFailed:
      typeof session.speechDeliveryFailed === "boolean"
        ? session.speechDeliveryFailed
        : false,
    wakeLockFailed:
      typeof session.wakeLockFailed === "boolean"
        ? session.wakeLockFailed
        : false,
    announcedCueIds: Array.isArray(session.announcedCueIds)
      ? session.announcedCueIds.filter(
          (id): id is string =>
            typeof id === "string" &&
            (routeIds.has(id) || id === "__complete__"),
        )
      : typeof session.lastAnnouncedStepId === "string"
        ? [session.lastAnnouncedStepId]
        : [],
  };
}

export function loadSession(now = Date.now()): ActiveSession | null {
  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    const preferences = loadPreferences();
    const fallbackSpace = activeRelaySpace(preferences);
    const parsed = normalizeSession(
      JSON.parse(saved) as unknown,
      fallbackSpace,
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
