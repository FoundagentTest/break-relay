import type { Preferences, RelaySpace, SpaceMode, Station } from "./types";

export const DEFAULT_SPACE_ID = "space-default";
export const DEFAULT_SPACE_NAME = "My space";
export const MAX_RELAY_SPACES = 6;
export const MAX_SPACE_NAME_LENGTH = 28;

export function initialRelaySpace(): RelaySpace {
  return {
    id: DEFAULT_SPACE_ID,
    name: DEFAULT_SPACE_NAME,
    stations: [],
    spaceMode: "any",
  };
}

export function activeRelaySpace(preferences: Preferences): RelaySpace {
  return (
    preferences.spaces.find(
      (space) => space.id === preferences.activeSpaceId,
    ) ??
    preferences.spaces[0] ??
    initialRelaySpace()
  );
}

export function cleanSpaceName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_SPACE_NAME_LENGTH);
}

export function spaceNameError(
  value: string,
  spaces: RelaySpace[],
  exceptId?: string,
) {
  const name = cleanSpaceName(value);
  if (name.length < 2) return "Use at least two characters.";
  if (
    spaces.some(
      (space) =>
        space.id !== exceptId &&
        space.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  ) {
    return "Choose a name that is not already in use.";
  }
  return "";
}

function randomToken() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto && typeof browserCrypto.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSpaceId(existing: Iterable<string>) {
  const used = new Set(existing);
  let id = `space-${randomToken()}`;
  while (used.has(id)) id = `space-${randomToken()}`;
  return id;
}

export function stationPresetId(station: Station) {
  return station.presetId ?? (station.custom ? null : station.id);
}

export function stationForSpace(
  station: Station,
  spaceId: string,
  existingIds: Iterable<string>,
) {
  const used = new Set(existingIds);
  const presetId = stationPresetId(station);
  const base = `${spaceId}:${presetId ?? "custom"}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}:${suffix}`;
    suffix += 1;
  }
  return {
    ...station,
    id,
    ...(presetId ? { presetId } : {}),
  };
}

export function customStationForSpace({
  name,
  spaceId,
  spaceMode,
  existingIds,
}: {
  name: string;
  spaceId: string;
  spaceMode: SpaceMode;
  existingIds: Iterable<string>;
}): Station {
  return stationForSpace(
    {
      id: "custom",
      name,
      kind: "custom",
      detail: "Your own reachable stop",
      modes:
        spaceMode === "seated"
          ? ["any", "small", "seated"]
          : spaceMode === "small"
            ? ["any", "small"]
            : ["any"],
      custom: true,
    },
    spaceId,
    existingIds,
  );
}

export function createEmptySpace(
  name: string,
  spaces: RelaySpace[],
): RelaySpace {
  return {
    id: createSpaceId(spaces.map((space) => space.id)),
    name: cleanSpaceName(name),
    stations: [],
    spaceMode: "any",
  };
}

export function duplicateRelaySpace(
  source: RelaySpace,
  name: string,
  spaces: RelaySpace[],
): RelaySpace {
  const id = createSpaceId(spaces.map((space) => space.id));
  const globallyUsed = new Set(
    spaces.flatMap((space) => space.stations.map((station) => station.id)),
  );
  const stations: Station[] = [];
  for (const station of source.stations) {
    const copy = stationForSpace(station, id, [
      ...globallyUsed,
      ...stations.map((item) => item.id),
    ]);
    stations.push(copy);
  }
  return {
    id,
    name: cleanSpaceName(name),
    stations,
    spaceMode: source.spaceMode,
  };
}
