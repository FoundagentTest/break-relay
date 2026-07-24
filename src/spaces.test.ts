import { beforeEach, describe, expect, it } from "vitest";
import { buildRoute, DEFAULT_PREFERENCES, STATION_PRESETS } from "./data";
import {
  ROUTE_MEMORY_STORAGE_KEY,
  loadRouteMemory,
} from "./routeMemory";
import { createSession } from "./session";
import {
  DEFAULT_SPACE_ID,
  duplicateRelaySpace,
  initialRelaySpace,
  stationForSpace,
} from "./spaces";
import {
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  loadPreferences,
  loadSession,
  savePreferences,
  saveSession,
} from "./storage";
import type {
  Preferences,
  RelaySpace,
  RouteHistoryEntry,
} from "./types";

function preferences(
  spaces: RelaySpace[],
  activeSpaceId = spaces[0].id,
): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    spaces,
    activeSpaceId,
    hasOnboarded: true,
    launchSetupComplete: true,
    audioEnabled: false,
  };
}

function station(spaceId: string, presetId: string) {
  return stationForSpace(
    STATION_PRESETS.find((item) => item.id === presetId)!,
    spaceId,
    [],
  );
}

function historyEntry({
  id,
  spaceId,
  stationId,
  outcome = "useful",
  completedAt,
}: {
  id: string;
  spaceId: string;
  stationId: string;
  outcome?: RouteHistoryEntry["outcome"];
  completedAt: number;
}): RouteHistoryEntry {
  return {
    version: 2,
    id,
    spaceId,
    feeling: "noise",
    durationMinutes: 5,
    spaceMode: "any",
    steps: [
      {
        stepId: `${id}-arrive`,
        stationId,
        stationName: "Window",
        action: "A remembered action",
        used: true,
        skipped: false,
      },
    ],
    extensionUsed: false,
    endedEarly: false,
    outcome,
    completedAt,
  };
}

describe("local relay spaces", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates single-space preferences and legacy history without setup loss", () => {
    const stations = STATION_PRESETS.slice(0, 4);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations,
        spaceMode: "small",
        feeling: "eyes",
        duration: 10,
        audioEnabled: false,
        keepAwake: true,
        hasOnboarded: true,
        launchSetupComplete: true,
      }),
    );
    localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            ...historyEntry({
              id: "legacy-history",
              spaceId: DEFAULT_SPACE_ID,
              stationId: "window",
              completedAt: 10,
            }),
            version: 1,
            spaceId: undefined,
          },
        ],
      }),
    );

    const migrated = loadPreferences();
    const memory = loadRouteMemory(migrated.activeSpaceId);

    expect(migrated).toMatchObject({
      version: 2,
      activeSpaceId: DEFAULT_SPACE_ID,
      feeling: "eyes",
      duration: 10,
      keepAwake: true,
      spaces: [
        {
          id: DEFAULT_SPACE_ID,
          name: "My space",
          spaceMode: "small",
        },
      ],
    });
    expect(migrated.spaces[0].stations).toEqual(stations);
    expect(memory.entries[0]).toMatchObject({
      version: 2,
      id: "legacy-history",
      spaceId: DEFAULT_SPACE_ID,
    });
  });

  it("recovers collisions and malformed active-space data deterministically", () => {
    const repeated = STATION_PRESETS[0];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        spaces: [
          {
            id: "home",
            name: "Home",
            stations: [repeated],
            spaceMode: "seated",
          },
          null,
          {
            id: "office",
            name: "Office",
            stations: [repeated, { broken: true }],
            spaceMode: "not-a-mode",
          },
        ],
        activeSpaceId: "missing",
        hasOnboarded: true,
      }),
    );

    const first = loadPreferences();
    savePreferences(first);
    const second = loadPreferences();

    expect(second).toEqual(first);
    expect(first.activeSpaceId).toBe("home");
    expect(first.spaces.map((space) => space.spaceMode)).toEqual([
      "seated",
      "any",
    ]);
    const ids = first.spaces.flatMap((space) =>
      space.stations.map((item) => item.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["window", "office:window"]);
  });

  it("clears unreadable preference data and restores the implicit first space", () => {
    localStorage.setItem(STORAGE_KEY, "{not-json");

    const recovered = loadPreferences();

    expect(recovered).toEqual(DEFAULT_PREFERENCES);
    expect(recovered.spaces).toEqual([initialRelaySpace()]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("duplicates repeated presets and custom names with distinct identities", () => {
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [
        station("home", "window"),
        {
          id: "home:custom",
          name: "Window",
          kind: "custom",
          detail: "Custom",
          modes: ["any"],
          custom: true,
        },
      ],
      spaceMode: "any",
    };
    const copy = duplicateRelaySpace(home, "Office", [home]);
    const allIds = [...home.stations, ...copy.stations].map(
      (item) => item.id,
    );

    expect(copy.spaceMode).toBe(home.spaceMode);
    expect(copy.stations.map((item) => item.name)).toEqual([
      "Window or view",
      "Window",
    ]);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(copy.stations.every((item) => item.id.startsWith(copy.id))).toBe(
      true,
    );
  });

  it("keeps a live route bound to its originating space after saved switching", () => {
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [station("home", "window")],
      spaceMode: "seated",
    };
    const office: RelaySpace = {
      id: "office",
      name: "Office",
      stations: [station("office", "hallway")],
      spaceMode: "any",
    };
    savePreferences(preferences([home, office], home.id));
    const route = buildRoute(home.stations, "eyes", 5, 22, {
      spaceId: home.id,
      spaceMode: home.spaceMode,
    });
    saveSession(
      createSession({
        route,
        durationMinutes: 5,
        audioEnabled: false,
        keepAwake: false,
        spaceSnapshot: home,
        routeContext: {
          spaceId: home.id,
          feeling: "eyes",
          spaceMode: home.spaceMode,
          steps: route
            .filter((step) => step.phase === "arrive")
            .map((step) => ({
              stepId: step.id,
              stationId: step.station.id,
              stationName: step.station.name,
              action: step.action,
            })),
        },
        eligibleStations: home.stations,
        now: 1_000,
        id: "home-session",
      }),
    );
    savePreferences(preferences([home, office], office.id));

    const recovered = loadSession(2_000);

    expect(recovered?.spaceSnapshot).toEqual(home);
    expect(recovered?.route).toEqual(route);
    expect(recovered?.eligibleStations).toEqual(home.stations);
    expect(recovered?.routeContext?.spaceId).toBe(home.id);
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}")
        .spaceSnapshot.id,
    ).toBe(home.id);
  });

  it("filters learning by space while retaining deterministic exploration and recency", () => {
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [
        station("home", "window"),
        station("home", "plant"),
        station("home", "quiet-corner"),
      ],
      spaceMode: "any",
    };
    const office: RelaySpace = {
      ...home,
      id: "office",
      name: "Office",
      stations: [
        station("office", "window"),
        station("office", "plant"),
        station("office", "quiet-corner"),
      ],
    };
    const unrelated = Array.from({ length: 10 }, (_, index) =>
      historyEntry({
        id: `home-${index}`,
        spaceId: home.id,
        stationId: home.stations[0].id,
        outcome: "not_fit",
        completedAt: index + 1,
      }),
    );

    for (let seed = 0; seed < 20; seed += 1) {
      const officeWithHomeHistory = buildRoute(
        office.stations,
        "noise",
        5,
        seed,
        {
          history: unrelated,
          spaceId: office.id,
          spaceMode: office.spaceMode,
        },
      );
      const officeWithoutHistory = buildRoute(
        office.stations,
        "noise",
        5,
        seed,
        {
          history: [],
          spaceId: office.id,
          spaceMode: office.spaceMode,
        },
      );
      expect(officeWithHomeHistory).toEqual(officeWithoutHistory);
    }
  });

  it("persists every space locally across a cold offline-style reload", () => {
    const home: RelaySpace = {
      ...initialRelaySpace(),
      stations: [station(DEFAULT_SPACE_ID, "window")],
    };
    const office: RelaySpace = {
      id: "office",
      name: "Temporary room",
      stations: [station("office", "water")],
      spaceMode: "small",
    };
    const saved = preferences([home, office], office.id);

    savePreferences(saved);
    const reloaded = loadPreferences();

    expect(reloaded).toEqual(saved);
    expect(reloaded.spaces[0].stations[0].id).not.toBe(
      reloaded.spaces[1].stations[0].id,
    );
  });
});
