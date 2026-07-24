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
  hasOnboarded: boolean;
}

export interface RouteStep {
  id: string;
  station: Station;
  action: string;
  spokenCue: string;
  durationSeconds: number;
  kind: "station" | "return" | "extension";
}

export interface ActiveSession {
  version: 1;
  id: string;
  route: RouteStep[];
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
  durationMinutes: number;
  completedAt: number | null;
  lastAnnouncedStepId: string | null;
  updatedAt: number;
}
