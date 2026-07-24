import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import type {
  Feeling,
  RelaySpace,
  RouteStep,
  SpaceMode,
  Station,
  StationKind,
} from "./types";

export const HANDOFF_VERSION = 1;
export const HANDOFF_FRAGMENT_KEY = "relay";
export const HANDOFF_TTL_MS = 15 * 60 * 1000;
export const MAX_HANDOFF_ENCODED_CHARS = 2700;
export const MAX_HANDOFF_JSON_BYTES = 32 * 1024;

export interface BreakHandoff {
  version: 1;
  id: string;
  createdAt: number;
  expiresAt: number;
  space: RelaySpace;
  feeling: Feeling;
  durationMinutes: 5 | 7 | 10;
  route: RouteStep[];
  eligibleStations: Station[];
  unavailableStationIds: string[];
}

export type HandoffFailure =
  | "corrupt"
  | "expired"
  | "oversized"
  | "unsupported";

export type HandoffCapture =
  | { status: "none" }
  | { status: "ready"; handoff: BreakHandoff }
  | { status: "error"; reason: HandoffFailure };

const FEELINGS = new Set<Feeling>(["noise", "eyes", "stiff", "air"]);
const SPACE_MODES = new Set<SpaceMode>(["any", "small", "seated"]);
const STATION_KINDS = new Set<StationKind>([
  "view",
  "water",
  "threshold",
  "movement",
  "nature",
  "rest",
  "custom",
]);
const ROUTE_PHASES = new Set<RouteStep["phase"]>([
  "move",
  "arrive",
  "quiet",
  "settle",
  "return",
  "extension",
]);
const GENERATED_STATION_IDS = new Set(["comfortable-pause", "desk-return"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isBoundedString(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim() === value
  );
}

function stationFromUnknown(value: unknown): Station | null {
  if (!isRecord(value)) return null;
  if (
    !hasOnlyKeys(
      value,
      ["id", "name", "kind", "detail", "modes"],
      ["presetId", "custom"],
    ) ||
    !isBoundedString(value.id, 1, 160) ||
    !isBoundedString(value.name, 1, 80) ||
    !isBoundedString(value.detail, 1, 240) ||
    !STATION_KINDS.has(value.kind as StationKind) ||
    !Array.isArray(value.modes) ||
    value.modes.length < 1 ||
    value.modes.length > 3 ||
    !value.modes.every((mode) => SPACE_MODES.has(mode as SpaceMode)) ||
    new Set(value.modes).size !== value.modes.length ||
    (Object.hasOwn(value, "presetId") &&
      !isBoundedString(value.presetId, 1, 80)) ||
    (Object.hasOwn(value, "custom") && typeof value.custom !== "boolean")
  ) {
    return null;
  }
  return {
    id: value.id as string,
    name: value.name as string,
    kind: value.kind as StationKind,
    detail: value.detail as string,
    modes: value.modes as SpaceMode[],
    ...(typeof value.presetId === "string"
      ? { presetId: value.presetId }
      : {}),
    ...(typeof value.custom === "boolean" ? { custom: value.custom } : {}),
  };
}

function sameStation(first: Station, second: Station) {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.kind === second.kind &&
    first.detail === second.detail &&
    first.presetId === second.presetId &&
    first.custom === second.custom &&
    first.modes.length === second.modes.length &&
    first.modes.every((mode, index) => mode === second.modes[index])
  );
}

function spaceFromUnknown(value: unknown): RelaySpace | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["id", "name", "stations", "spaceMode"]) ||
    !isBoundedString(value.id, 1, 120) ||
    !isBoundedString(value.name, 2, 28) ||
    !SPACE_MODES.has(value.spaceMode as SpaceMode) ||
    !Array.isArray(value.stations) ||
    value.stations.length > 12
  ) {
    return null;
  }
  const stations = value.stations.map(stationFromUnknown);
  if (
    stations.some((station) => station === null) ||
    new Set(stations.map((station) => station?.id)).size !== stations.length
  ) {
    return null;
  }
  return {
    id: value.id as string,
    name: value.name as string,
    stations: stations as Station[],
    spaceMode: value.spaceMode as SpaceMode,
  };
}

function routeStepFromUnknown(value: unknown): RouteStep | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "station",
      "action",
      "spokenCue",
      "durationSeconds",
      "phase",
    ]) ||
    !isBoundedString(value.id, 1, 200) ||
    !isBoundedString(value.action, 1, 800) ||
    !isBoundedString(value.spokenCue, 1, 900) ||
    !Number.isInteger(value.durationSeconds) ||
    (value.durationSeconds as number) < 1 ||
    (value.durationSeconds as number) > 600 ||
    !ROUTE_PHASES.has(value.phase as RouteStep["phase"])
  ) {
    return null;
  }
  const station = stationFromUnknown(value.station);
  if (!station) return null;
  return {
    id: value.id as string,
    station,
    action: value.action as string,
    spokenCue: value.spokenCue as string,
    durationSeconds: value.durationSeconds as number,
    phase: value.phase as RouteStep["phase"],
  };
}

function handoffFromUnknown(
  value: unknown,
  now: number,
): { handoff?: BreakHandoff; reason?: HandoffFailure } {
  if (!isRecord(value)) return { reason: "corrupt" };
  if (value.version !== HANDOFF_VERSION) return { reason: "unsupported" };
  if (
    !hasOnlyKeys(value, [
      "version",
      "id",
      "createdAt",
      "expiresAt",
      "space",
      "feeling",
      "durationMinutes",
      "route",
      "eligibleStations",
      "unavailableStationIds",
    ]) ||
    !isBoundedString(value.id, 8, 120) ||
    !Number.isInteger(value.createdAt) ||
    !Number.isInteger(value.expiresAt) ||
    (value.expiresAt as number) <= (value.createdAt as number) ||
    (value.expiresAt as number) - (value.createdAt as number) >
      HANDOFF_TTL_MS ||
    (value.createdAt as number) > now + 2 * 60 * 1000 ||
    !FEELINGS.has(value.feeling as Feeling) ||
    ![5, 7, 10].includes(value.durationMinutes as number) ||
    !Array.isArray(value.route) ||
    value.route.length < 2 ||
    value.route.length > 8 ||
    !Array.isArray(value.eligibleStations) ||
    value.eligibleStations.length > 12 ||
    !Array.isArray(value.unavailableStationIds) ||
    value.unavailableStationIds.length > 12 ||
    !value.unavailableStationIds.every((id) =>
      isBoundedString(id, 1, 160),
    ) ||
    new Set(value.unavailableStationIds).size !==
      value.unavailableStationIds.length
  ) {
    return { reason: "corrupt" };
  }
  if ((value.expiresAt as number) <= now) return { reason: "expired" };

  const space = spaceFromUnknown(value.space);
  const route = value.route.map(routeStepFromUnknown);
  const eligibleStations = value.eligibleStations.map(stationFromUnknown);
  if (
    !space ||
    route.some((step) => step === null) ||
    eligibleStations.some((station) => station === null)
  ) {
    return { reason: "corrupt" };
  }
  const exactRoute = route as RouteStep[];
  const exactEligible = eligibleStations as Station[];
  if (
    new Set(exactRoute.map((step) => step.id)).size !== exactRoute.length ||
    new Set(exactEligible.map((station) => station.id)).size !==
      exactEligible.length ||
    exactRoute.at(-1)?.phase !== "return" ||
    exactRoute.at(-1)?.station.id !== "desk-return" ||
    exactRoute
      .reduce((seconds, step) => seconds + step.durationSeconds, 0) !==
      (value.durationMinutes as number) * 60
  ) {
    return { reason: "corrupt" };
  }

  const spaceById = new Map(
    space.stations.map((station) => [station.id, station]),
  );
  const eligibleById = new Map(
    exactEligible.map((station) => [station.id, station]),
  );
  if (
    exactEligible.some((station) => {
      const saved = spaceById.get(station.id);
      return !saved || !sameStation(saved, station);
    }) ||
    value.unavailableStationIds.some(
      (id) => !spaceById.has(id) || eligibleById.has(id),
    ) ||
    exactRoute.some((step) => {
      if (GENERATED_STATION_IDS.has(step.station.id)) return false;
      const eligible = eligibleById.get(step.station.id);
      return !eligible || !sameStation(eligible, step.station);
    })
  ) {
    return { reason: "corrupt" };
  }

  return {
    handoff: {
      version: 1,
      id: value.id as string,
      createdAt: value.createdAt as number,
      expiresAt: value.expiresAt as number,
      space,
      feeling: value.feeling as Feeling,
      durationMinutes: value.durationMinutes as 5 | 7 | 10,
      route: exactRoute,
      eligibleStations: exactEligible,
      unavailableStationIds: value.unavailableStationIds as string[],
    },
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url");
  }
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function handoffId(now: number) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `handoff-${now}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createBreakHandoff({
  space,
  feeling,
  durationMinutes,
  route,
  eligibleStations,
  unavailableStationIds,
  now = Date.now(),
}: {
  space: RelaySpace;
  feeling: Feeling;
  durationMinutes: 5 | 7 | 10;
  route: RouteStep[];
  eligibleStations: Station[];
  unavailableStationIds: string[];
  now?: number;
}): BreakHandoff {
  return {
    version: 1,
    id: handoffId(now),
    createdAt: now,
    expiresAt: now + HANDOFF_TTL_MS,
    space: structuredClone(space),
    feeling,
    durationMinutes,
    route: structuredClone(route),
    eligibleStations: structuredClone(eligibleStations),
    unavailableStationIds: [...unavailableStationIds],
  };
}

export function regenerateBreakHandoff(
  handoff: BreakHandoff,
  now = Date.now(),
): BreakHandoff {
  return {
    ...structuredClone(handoff),
    id: handoffId(now),
    createdAt: now,
    expiresAt: now + HANDOFF_TTL_MS,
  };
}

export function encodeBreakHandoff(handoff: BreakHandoff) {
  const json = JSON.stringify(handoff);
  const jsonBytes = strToU8(json);
  if (jsonBytes.length > MAX_HANDOFF_JSON_BYTES) {
    throw new Error("oversized");
  }
  const encoded = bytesToBase64Url(zlibSync(jsonBytes, { level: 9 }));
  if (encoded.length > MAX_HANDOFF_ENCODED_CHARS) {
    throw new Error("oversized");
  }
  return encoded;
}

export function decodeBreakHandoff(
  encoded: string,
  now = Date.now(),
): HandoffCapture {
  if (!encoded || encoded.length > MAX_HANDOFF_ENCODED_CHARS) {
    return { status: "error", reason: "oversized" };
  }
  try {
    const jsonBytes = unzlibSync(base64UrlToBytes(encoded), {
      out: new Uint8Array(MAX_HANDOFF_JSON_BYTES + 1),
    });
    if (jsonBytes.length > MAX_HANDOFF_JSON_BYTES) {
      return { status: "error", reason: "oversized" };
    }
    const result = handoffFromUnknown(
      JSON.parse(strFromU8(jsonBytes)) as unknown,
      now,
    );
    return result.handoff
      ? { status: "ready", handoff: result.handoff }
      : { status: "error", reason: result.reason ?? "corrupt" };
  } catch {
    return { status: "error", reason: "corrupt" };
  }
}

export function handoffUrl(handoff: BreakHandoff, baseUrl: string) {
  const url = new URL(baseUrl);
  url.hash = `${HANDOFF_FRAGMENT_KEY}=${encodeBreakHandoff(handoff)}`;
  return url.toString();
}

export function captureHandoffFromLocation(
  browserWindow: Window = window,
  now = Date.now(),
): HandoffCapture {
  const prefix = `#${HANDOFF_FRAGMENT_KEY}=`;
  const hash = browserWindow.location.hash;
  if (!hash.startsWith(prefix)) return { status: "none" };

  const encoded = hash.slice(prefix.length);
  browserWindow.history.replaceState(
    browserWindow.history.state,
    "",
    `${browserWindow.location.pathname}${browserWindow.location.search}`,
  );
  return decodeBreakHandoff(encoded, now);
}
