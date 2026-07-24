export type Feeling = "noise" | "eyes" | "stiff" | "air";
export type SpaceMode = "any" | "small" | "seated";
export type StationKind =
  | "view"
  | "water"
  | "threshold"
  | "movement"
  | "nature"
  | "rest"
  | "custom";

export interface Station {
  id: string;
  name: string;
  kind: StationKind;
  detail: string;
  modes: SpaceMode[];
  custom?: boolean;
}

export interface Preferences {
  stations: Station[];
  feeling: Feeling;
  duration: 5 | 7 | 10;
  spaceMode: SpaceMode;
  audioEnabled: boolean;
  keepAwake: boolean;
  alwaysReviewLaunch: boolean;
  launchSetupComplete: boolean;
  launchNeedsReview: boolean;
  capabilitySnapshot: LaunchCapabilitySnapshot | null;
  hasOnboarded: boolean;
}

export interface LaunchCapabilitySnapshot {
  speech: boolean;
  wakeLock: boolean;
}

export interface RouteStep {
  id: string;
  station: Station;
  action: string;
  spokenCue: string;
  durationSeconds: number;
  phase: "move" | "arrive" | "quiet" | "settle" | "return" | "extension";
}

export type RouteOutcome = "useful" | "not_fit" | "unrated";

export interface RouteMemoryStep {
  stepId: string;
  stationId: string;
  stationName: string;
  action: string;
  used: boolean;
  skipped: boolean;
}

export interface RouteHistoryEntry {
  version: 1;
  id: string;
  feeling: Feeling;
  durationMinutes: number;
  spaceMode: SpaceMode;
  steps: RouteMemoryStep[];
  extensionUsed: boolean;
  endedEarly: boolean;
  outcome: RouteOutcome;
  completedAt: number;
}

export interface RouteMemory {
  version: 1;
  entries: RouteHistoryEntry[];
}

export interface SessionRouteContext {
  feeling: Feeling;
  spaceMode: SpaceMode;
  steps: Omit<RouteMemoryStep, "used" | "skipped">[];
}

export interface ActiveSession {
  version: 4;
  id: string;
  route: RouteStep[];
  routeContext: SessionRouteContext | null;
  skippedStepIds: string[];
  reachedStepIds: string[];
  startedAt: number;
  stepDeadlineAt: number;
  deadlineAt: number;
  currentStepIndex: number;
  paused: boolean;
  pausedAt: number | null;
  status: "active" | "complete";
  endedEarly: boolean;
  extensionUsed: boolean;
  audioEnabled: boolean;
  keepAwake: boolean;
  cueDeliveryFailed: boolean;
  wakeLockFailed: boolean;
  durationMinutes: number;
  completedAt: number | null;
  lastAnnouncedStepId: string | null;
  updatedAt: number;
}
