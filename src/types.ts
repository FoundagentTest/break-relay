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
  presetId?: string;
  custom?: boolean;
}

export interface RelaySpace {
  id: string;
  name: string;
  stations: Station[];
  spaceMode: SpaceMode;
}

export interface Preferences {
  version: 2;
  spaces: RelaySpace[];
  activeSpaceId: string;
  feeling: Feeling;
  duration: 5 | 7 | 10;
  cueSoundEnabled: boolean;
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
  checkedAt?: number;
  signature?: string;
  chimeVerified?: boolean;
  audibilityConfirmed?: boolean;
  visualOnlyAcknowledged?: boolean;
  speechVerified?: boolean;
  wakeVerified?: boolean;
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
  version: 2;
  id: string;
  spaceId: string;
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
  version: 2;
  entries: RouteHistoryEntry[];
}

export interface SessionRouteContext {
  spaceId?: string;
  feeling: Feeling;
  spaceMode: SpaceMode;
  steps: Omit<RouteMemoryStep, "used" | "skipped">[];
}

export interface ActiveSession {
  version: 7;
  id: string;
  source: "local" | "handoff";
  spaceSnapshot: RelaySpace;
  route: RouteStep[];
  routeContext: SessionRouteContext | null;
  skippedStepIds: string[];
  reachedStepIds: string[];
  neutralStepIds: string[];
  eligibleStations: Station[];
  unavailableStationIds: string[];
  rerouteCount: number;
  startedAt: number;
  stepDeadlineAt: number;
  deadlineAt: number;
  originalDeadlineAt: number;
  currentStepIndex: number;
  paused: boolean;
  pausedAt: number | null;
  status: "active" | "complete";
  endedEarly: boolean;
  extensionUsed: boolean;
  cueSoundEnabled: boolean;
  audioEnabled: boolean;
  keepAwake: boolean;
  cueDeliveryFailed: boolean;
  speechDeliveryFailed: boolean;
  wakeLockFailed: boolean;
  durationMinutes: number;
  completedAt: number | null;
  lastAnnouncedStepId: string | null;
  announcedCueIds: string[];
  updatedAt: number;
}
