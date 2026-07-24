import type {
  ActiveSession,
  RelaySpace,
  RouteStep,
  SessionRouteContext,
} from "./types";
import { initialRelaySpace } from "./spaces";
import {
  isLearnableRouteStep,
  routeMemoryContextSteps,
} from "./routeMemory";

const SECOND = 1000;
export const FINAL_CUE_ID = "__complete__";

function routeDurationMs(route: RouteStep[]) {
  return route.reduce(
    (total, step) => total + step.durationSeconds * SECOND,
    0,
  );
}

function createSessionId(now: number) {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto && typeof browserCrypto.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }
  return `relay-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

function reachedAt(route: RouteStep[], index: number, existing: string[]) {
  const step = route[index];
  return [
    ...new Set([
      ...existing,
      ...(step && isLearnableRouteStep(step) ? [step.id] : []),
    ]),
  ];
}

export function createSession({
  route,
  durationMinutes,
  cueSoundEnabled = true,
  audioEnabled,
  keepAwake,
  extensionUsed = false,
  routeContext = null,
  skippedStepIds = [],
  reachedStepIds,
  neutralStepIds = [],
  eligibleStations = [],
  unavailableStationIds = [],
  rerouteCount = 0,
  now = Date.now(),
  id,
  source = "local",
  spaceSnapshot = initialRelaySpace(),
}: {
  route: RouteStep[];
  durationMinutes: number;
  cueSoundEnabled?: boolean;
  audioEnabled: boolean;
  keepAwake: boolean;
  extensionUsed?: boolean;
  routeContext?: SessionRouteContext | null;
  skippedStepIds?: string[];
  reachedStepIds?: string[];
  neutralStepIds?: string[];
  eligibleStations?: ActiveSession["eligibleStations"];
  unavailableStationIds?: string[];
  rerouteCount?: number;
  now?: number;
  id?: string;
  source?: ActiveSession["source"];
  spaceSnapshot?: RelaySpace;
}): ActiveSession {
  if (route.length === 0) throw new Error("A relay needs at least one step.");
  const firstStepMs = route[0].durationSeconds * SECOND;
  const deadlineAt = now + routeDurationMs(route);
  return {
    version: 7,
    id: id ?? createSessionId(now),
    source,
    spaceSnapshot: structuredClone(spaceSnapshot),
    route,
    routeContext,
    skippedStepIds,
    reachedStepIds:
      reachedStepIds ??
      (isLearnableRouteStep(route[0]) ? [route[0].id] : []),
    neutralStepIds,
    eligibleStations,
    unavailableStationIds,
    rerouteCount,
    startedAt: now,
    stepDeadlineAt: now + firstStepMs,
    deadlineAt,
    originalDeadlineAt: deadlineAt,
    currentStepIndex: 0,
    paused: false,
    pausedAt: null,
    status: "active",
    endedEarly: false,
    extensionUsed,
    cueSoundEnabled,
    audioEnabled,
    keepAwake,
    cueDeliveryFailed: false,
    speechDeliveryFailed: false,
    wakeLockFailed: false,
    durationMinutes,
    completedAt: null,
    lastAnnouncedStepId: null,
    announcedCueIds: [],
    updatedAt: now,
  };
}

export function remainingMs(session: ActiveSession, now = Date.now()) {
  if (session.status === "complete") return 0;
  return Math.max(0, session.deadlineAt - now);
}

export function reconcileSession(
  session: ActiveSession,
  now = Date.now(),
): ActiveSession {
  if (session.status === "complete") return session;

  if (now >= session.deadlineAt) {
    return {
      ...session,
      currentStepIndex: session.route.length - 1,
      status: "complete",
      completedAt: session.deadlineAt,
      paused: false,
      pausedAt: null,
      eligibleStations: [],
      unavailableStationIds: [],
      updatedAt: now,
    };
  }

  if (session.paused) return session;

  let currentStepIndex = session.currentStepIndex;
  let stepDeadlineAt = session.stepDeadlineAt;

  while (
    currentStepIndex < session.route.length - 1 &&
    now >= stepDeadlineAt
  ) {
    currentStepIndex += 1;
    stepDeadlineAt +=
      session.route[currentStepIndex].durationSeconds * SECOND;
  }

  if (
    currentStepIndex === session.currentStepIndex &&
    stepDeadlineAt === session.stepDeadlineAt
  ) {
    return session;
  }

  return {
    ...session,
    currentStepIndex,
    stepDeadlineAt,
    reachedStepIds: reachedAt(
      session.route,
      currentStepIndex,
      session.reachedStepIds,
    ),
    updatedAt: now,
  };
}

export function pauseSession(session: ActiveSession, now = Date.now()) {
  const current = reconcileSession(session, now);
  if (current.status === "complete" || current.paused) return current;
  return {
    ...current,
    paused: true,
    pausedAt: now,
    updatedAt: now,
  };
}

export function resumeSession(session: ActiveSession, now = Date.now()) {
  if (
    session.status === "complete" ||
    !session.paused ||
    session.pausedAt === null
  ) {
    return reconcileSession(session, now);
  }
  return reconcileSession({
    ...session,
    paused: false,
    pausedAt: null,
    updatedAt: now,
  }, now);
}

export function skipStep(session: ActiveSession, now = Date.now()) {
  const current = reconcileSession(session, now);
  if (current.status === "complete") return current;
  if (current.currentStepIndex >= current.route.length - 1) {
    return completeSession(current, false, now);
  }

  const currentStepIndex = current.currentStepIndex + 1;
  const route = current.route.map((step) => ({ ...step }));
  const scheduledRemainingSeconds = route
    .slice(currentStepIndex)
    .reduce((total, step) => total + step.durationSeconds, 0);
  const absoluteRemainingSeconds = Math.max(
    1,
    Math.ceil(
      (current.deadlineAt -
        (current.paused && current.pausedAt !== null
          ? current.pausedAt
          : now)) /
        SECOND,
    ),
  );
  const pacingSlack =
    absoluteRemainingSeconds - scheduledRemainingSeconds;
  const quietIndex = route.findIndex(
    (step, index) =>
      index >= currentStepIndex && step.phase === "quiet",
  );
  if (pacingSlack > 0 && quietIndex >= currentStepIndex) {
    route[quietIndex].durationSeconds += pacingSlack;
  }
  const scheduleReference =
    current.paused && current.pausedAt !== null
      ? current.pausedAt
      : now;
  const stepDeadlineAt =
    scheduleReference +
    route[currentStepIndex].durationSeconds * SECOND;
  const skippedStepIds =
    isLearnableRouteStep(current.route[current.currentStepIndex])
      ? [
          ...current.skippedStepIds,
          current.route[current.currentStepIndex].id,
        ]
      : current.skippedStepIds;

  return {
    ...current,
    route,
    currentStepIndex,
    skippedStepIds,
    reachedStepIds: reachedAt(
      route,
      currentStepIndex,
      current.reachedStepIds,
    ),
    stepDeadlineAt,
    lastAnnouncedStepId: null,
    updatedAt: now,
  };
}

export function recomposeSession(
  session: ActiveSession,
  replacementRoute: RouteStep[],
  rejectedStationId: string,
  now = Date.now(),
) {
  const current = reconcileSession(session, now);
  if (
    current.status === "complete" ||
    replacementRoute.length === 0 ||
    current.unavailableStationIds.includes(rejectedStationId) ||
    current.rerouteCount >= current.eligibleStations.length
  ) {
    return current;
  }

  const unavailableStationIds = [
    ...current.unavailableStationIds,
    rejectedStationId,
  ];
  const rejectedStepIds =
    current.routeContext?.steps
      .filter((step) => step.stationId === rejectedStationId)
      .map((step) => step.stepId) ?? [];
  const replacementContextSteps = routeMemoryContextSteps(replacementRoute);
  const existingContext = current.routeContext;
  const contextSteps = [
    ...(existingContext?.steps ?? []),
    ...replacementContextSteps,
  ].filter(
    (step, index, steps) =>
      steps.findIndex((candidate) => candidate.stepId === step.stepId) ===
      index,
  );
  const scheduleReference =
    current.paused && current.pausedAt !== null
      ? current.pausedAt
      : now;

  return {
    ...current,
    route: replacementRoute,
    routeContext: existingContext
      ? { ...existingContext, steps: contextSteps }
      : null,
    currentStepIndex: 0,
    stepDeadlineAt:
      scheduleReference +
      replacementRoute[0].durationSeconds * SECOND,
    skippedStepIds: current.skippedStepIds,
    reachedStepIds: reachedAt(
      replacementRoute,
      0,
      current.reachedStepIds,
    ),
    neutralStepIds: [
      ...new Set([...current.neutralStepIds, ...rejectedStepIds]),
    ],
    unavailableStationIds,
    rerouteCount: current.rerouteCount + 1,
    lastAnnouncedStepId: null,
    updatedAt: now,
  };
}

export function completeSession(
  session: ActiveSession,
  endedEarly: boolean,
  now = Date.now(),
): ActiveSession {
  if (session.status === "complete") return session;
  return {
    ...session,
    status: "complete",
    endedEarly,
    completedAt: now,
    eligibleStations: [],
    unavailableStationIds: [],
    paused: false,
    pausedAt: null,
    updatedAt: now,
  };
}

export function markCueAnnounced(session: ActiveSession, now = Date.now()) {
  const stepId = session.route[session.currentStepIndex]?.id;
  if (!stepId || session.announcedCueIds.includes(stepId)) return session;
  return {
    ...session,
    lastAnnouncedStepId: stepId,
    announcedCueIds: [...session.announcedCueIds, stepId],
    updatedAt: now,
  };
}

export function shouldAnnounceCue(session: ActiveSession) {
  const stepId = session.route[session.currentStepIndex]?.id;
  return (
    session.status === "active" &&
    !session.paused &&
    !!stepId &&
    !session.announcedCueIds.includes(stepId)
  );
}

export function shouldIssueFinalCue(session: ActiveSession) {
  return (
    session.status === "complete" &&
    !session.announcedCueIds.includes(FINAL_CUE_ID)
  );
}

export function markFinalCueIssued(
  session: ActiveSession,
  now = Date.now(),
) {
  if (!shouldIssueFinalCue(session)) return session;
  return {
    ...session,
    lastAnnouncedStepId: FINAL_CUE_ID,
    announcedCueIds: [
      ...new Set([...session.announcedCueIds, FINAL_CUE_ID]),
    ],
    updatedAt: now,
  };
}

export function replaceWithExtension(
  session: ActiveSession,
  route: RouteStep[],
  now = Date.now(),
) {
  return {
    ...createSession({
      route,
      durationMinutes: session.durationMinutes,
      cueSoundEnabled: session.cueSoundEnabled,
      audioEnabled: session.audioEnabled,
      keepAwake: session.keepAwake,
      extensionUsed: true,
      routeContext: session.routeContext,
      skippedStepIds: session.skippedStepIds,
      reachedStepIds: session.reachedStepIds,
      neutralStepIds: session.neutralStepIds,
      now,
      id: session.id,
      source: session.source,
      spaceSnapshot: session.spaceSnapshot,
    }),
    extensionUsed: true,
    originalDeadlineAt: session.originalDeadlineAt,
  };
}
