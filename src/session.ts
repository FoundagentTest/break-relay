import type { ActiveSession, RouteStep } from "./types";

const SECOND = 1000;

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

export function createSession({
  route,
  durationMinutes,
  audioEnabled,
  keepAwake,
  extensionUsed = false,
  now = Date.now(),
  id,
}: {
  route: RouteStep[];
  durationMinutes: number;
  audioEnabled: boolean;
  keepAwake: boolean;
  extensionUsed?: boolean;
  now?: number;
  id?: string;
}): ActiveSession {
  if (route.length === 0) throw new Error("A relay needs at least one step.");
  const firstStepMs = route[0].durationSeconds * SECOND;
  return {
    version: 1,
    id: id ?? createSessionId(now),
    route,
    startedAt: now,
    stepDeadlineAt: now + firstStepMs,
    deadlineAt: now + routeDurationMs(route),
    currentStepIndex: 0,
    paused: false,
    pausedAt: null,
    status: "active",
    endedEarly: false,
    extensionUsed,
    audioEnabled,
    keepAwake,
    durationMinutes,
    completedAt: null,
    lastAnnouncedStepId: null,
    updatedAt: now,
  };
}

export function remainingMs(session: ActiveSession, now = Date.now()) {
  if (session.status === "complete") return 0;
  const reference = session.paused && session.pausedAt !== null
    ? session.pausedAt
    : now;
  return Math.max(0, session.deadlineAt - reference);
}

export function reconcileSession(
  session: ActiveSession,
  now = Date.now(),
): ActiveSession {
  if (session.status === "complete" || session.paused) return session;

  if (now >= session.deadlineAt) {
    return {
      ...session,
      currentStepIndex: session.route.length - 1,
      status: "complete",
      completedAt: session.deadlineAt,
      updatedAt: now,
    };
  }

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
    currentStepIndex === session.route.length - 1 &&
    now >= stepDeadlineAt
  ) {
    return {
      ...session,
      currentStepIndex,
      stepDeadlineAt,
      status: "complete",
      completedAt: Math.min(stepDeadlineAt, session.deadlineAt),
      updatedAt: now,
    };
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
  const pausedFor = Math.max(0, now - session.pausedAt);
  return {
    ...session,
    paused: false,
    pausedAt: null,
    stepDeadlineAt: session.stepDeadlineAt + pausedFor,
    deadlineAt: session.deadlineAt + pausedFor,
    updatedAt: now,
  };
}

export function skipStep(session: ActiveSession, now = Date.now()) {
  const current = reconcileSession(session, now);
  if (current.status === "complete") return current;
  if (current.currentStepIndex >= current.route.length - 1) {
    return completeSession(current, false, now);
  }

  const currentStepIndex = current.currentStepIndex + 1;
  const stepDeadlineAt =
    now + current.route[currentStepIndex].durationSeconds * SECOND;
  const futureDuration = current.route
    .slice(currentStepIndex + 1)
    .reduce((total, step) => total + step.durationSeconds * SECOND, 0);

  return {
    ...current,
    currentStepIndex,
    stepDeadlineAt,
    deadlineAt: stepDeadlineAt + futureDuration,
    pausedAt: current.paused ? now : null,
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
    paused: false,
    pausedAt: null,
    updatedAt: now,
  };
}

export function markCueAnnounced(session: ActiveSession, now = Date.now()) {
  const stepId = session.route[session.currentStepIndex]?.id;
  if (!stepId || session.lastAnnouncedStepId === stepId) return session;
  return {
    ...session,
    lastAnnouncedStepId: stepId,
    updatedAt: now,
  };
}

export function shouldAnnounceCue(session: ActiveSession) {
  return (
    session.status === "active" &&
    !session.paused &&
    session.route[session.currentStepIndex]?.id !==
      session.lastAnnouncedStepId
  );
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
      audioEnabled: session.audioEnabled,
      keepAwake: session.keepAwake,
      extensionUsed: true,
      now,
      id: session.id,
    }),
    extensionUsed: true,
  };
}
