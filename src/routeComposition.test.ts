import { describe, expect, it } from "vitest";
import { buildRoute, STATION_PRESETS } from "./data";
import type {
  Feeling,
  RouteStep,
  SpaceMode,
  Station,
} from "./types";

const feelings: Feeling[] = ["noise", "eyes", "stiff", "air"];
const durations = [5, 7, 10] as const;
const modes: SpaceMode[] = ["any", "small", "seated"];

function presetsFor(mode: SpaceMode) {
  return STATION_PRESETS.filter((station) => station.modes.includes(mode));
}

function totalSeconds(route: RouteStep[]) {
  return route.reduce((total, phase) => total + phase.durationSeconds, 0);
}

function configuredDestinationIds(route: RouteStep[]) {
  return [
    ...new Set(
      route
        .filter((phase) =>
          ["move", "arrive"].includes(phase.phase),
        )
        .map((phase) => phase.station.id),
    ),
  ];
}

describe("restorative phase composition", () => {
  it("is deterministic and exact for every need, duration, mode, and 3–6 station count", () => {
    for (const mode of modes) {
      const available = presetsFor(mode);
      for (const stationCount of [3, 4, 5, 6]) {
        const stations = available.slice(0, stationCount);
        expect(stations).toHaveLength(stationCount);
        for (const feeling of feelings) {
          for (const duration of durations) {
            const seed =
              10_000 +
              stationCount * 100 +
              duration * 10 +
              feelings.indexOf(feeling);
            const route = buildRoute(
              stations,
              feeling,
              duration,
              seed,
              { spaceMode: mode },
            );
            expect(
              buildRoute(stations, feeling, duration, seed, {
                spaceMode: mode,
              }),
            ).toEqual(route);
            expect(totalSeconds(route)).toBe(duration * 60);
            expect(route[0].phase).toBe("move");
            expect(route[1].phase).toBe("arrive");
            expect(route.at(-1)?.phase).toBe("return");
            expect(route.filter((phase) => phase.phase === "move")).toHaveLength(
              1,
            );
            expect(configuredDestinationIds(route)).toHaveLength(1);
            expect(
              route
                .filter((phase) => phase.station.id !== "comfortable-pause")
                .every(
                  (phase) =>
                    phase.phase === "return" ||
                    stations.some(
                      (station) => station.id === phase.station.id,
                    ),
                ),
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps transition, action, quiet, and return phases in sensible ranges", () => {
    const expectedReturn: Record<SpaceMode, number> = {
      any: 70,
      small: 50,
      seated: 40,
    };
    for (const mode of modes) {
      const stations = presetsFor(mode).slice(0, 6);
      for (const duration of durations) {
        const route = buildRoute(stations, "eyes", duration, 212, {
          spaceMode: mode,
        });
        const move = route.find((phase) => phase.phase === "move")!;
        const arrive = route.find((phase) => phase.phase === "arrive")!;
        const quiet = route.filter((phase) => phase.phase === "quiet");
        const returning = route.at(-1)!;

        expect(move.durationSeconds).toBeGreaterThanOrEqual(15);
        expect(move.durationSeconds).toBeLessThanOrEqual(35);
        expect(arrive.durationSeconds).toBeGreaterThanOrEqual(35);
        expect(arrive.durationSeconds).toBeLessThanOrEqual(75);
        expect(quiet).toHaveLength(duration === 5 ? 1 : 2);
        expect(
          quiet.every(
            (phase) =>
              phase.durationSeconds >= 90 &&
              phase.durationSeconds <= 260,
          ),
        ).toBe(true);
        expect(returning.durationSeconds).toBe(expectedReturn[mode]);
        expect(
          totalSeconds(route.slice(0, -1)),
        ).toBe(duration * 60 - expectedReturn[mode]);
      }
    }
  });

  it("uses a same-place quiet follow-up without relabeling it as another destination", () => {
    const view = STATION_PRESETS.find(
      (station) => station.id === "window",
    )!;
    const plant = STATION_PRESETS.find(
      (station) => station.id === "plant",
    )!;
    const rest = STATION_PRESETS.find(
      (station) => station.id === "quiet-corner",
    )!;

    for (const duration of [7, 10] as const) {
      const route = buildRoute(
        [view, plant, rest],
        "noise",
        duration,
        44,
      );
      const arrival = route.find((phase) => phase.phase === "arrive")!;
      const quiet = route.filter((phase) => phase.phase === "quiet");

      expect(quiet).toHaveLength(2);
      expect(
        quiet.every((phase) => phase.station.id === arrival.station.id),
      ).toBe(true);
      expect(quiet[0].action).not.toBe(quiet[1].action);
      expect(quiet[0].spokenCue).toMatch(/^Stay at /);
      expect(route.some((phase) => phase.phase === "settle")).toBe(false);
    }
  });

  it("never pads quick custom-only or utility actions into the quiet hold", () => {
    const customStations: Station[] = Array.from(
      { length: 6 },
      (_, index) => ({
        id: `custom-${index}`,
        name: `Custom place ${index + 1}`,
        kind: "custom",
        detail: "A user-named reachable place",
        modes: ["any", "small", "seated"],
        custom: true,
      }),
    );
    const utilityStations = STATION_PRESETS.filter((station) =>
      ["water", "doorway", "clear-floor"].includes(station.id),
    );

    const cases: Array<{
      stations: Station[];
      mode: SpaceMode;
    }> = [
      ...modes.flatMap((mode) =>
        [3, 4, 5, 6].map((count) => ({
          stations: customStations.slice(0, count),
          mode,
        })),
      ),
      { stations: utilityStations, mode: "any" },
    ];

    for (const { stations, mode } of cases) {
      for (const duration of durations) {
        const route = buildRoute(stations, "air", duration, 83, {
          spaceMode: mode,
        });
        const arrival = route.find((phase) => phase.phase === "arrive")!;
        const settle = route.find((phase) => phase.phase === "settle")!;
        const quiet = route.filter((phase) => phase.phase === "quiet");

        expect(arrival.durationSeconds).toBeLessThanOrEqual(75);
        expect(settle.station.id).toBe("comfortable-pause");
        expect(settle.durationSeconds).toBeLessThanOrEqual(25);
        expect(
          quiet.every(
            (phase) => phase.station.id === "comfortable-pause",
          ),
        ).toBe(true);
        expect(
          route.filter((phase) => phase.phase === "move"),
        ).toHaveLength(1);
      }
    }
  });

  it("prefers an appropriate quiet-capable station in a lopsided set", () => {
    const stations = [
      STATION_PRESETS.find((station) => station.id === "water")!,
      STATION_PRESETS.find((station) => station.id === "doorway")!,
      STATION_PRESETS.find((station) => station.id === "clear-floor")!,
      STATION_PRESETS.find((station) => station.id === "window")!,
      STATION_PRESETS.find((station) => station.id === "hallway")!,
      STATION_PRESETS.find((station) => station.id === "outside")!,
    ];
    for (const feeling of feelings) {
      const route = buildRoute(stations, feeling, 10, 14);
      const arrival = route.find((phase) => phase.phase === "arrive")!;
      expect(arrival.station.id).toBe("window");
      expect(route.some((phase) => phase.phase === "settle")).toBe(false);
    }
  });

  it("gives one-room and low-movement routes the complete arc in mode-safe language", () => {
    for (const mode of ["small", "seated"] as const) {
      const stations = presetsFor(mode).slice(0, 6);
      const route = buildRoute(stations, "stiff", 7, 91, {
        spaceMode: mode,
      });
      expect(route.map((phase) => phase.phase)).toEqual([
        "move",
        "arrive",
        "quiet",
        "quiet",
        "return",
      ]);
      expect(
        route
          .filter((phase) => phase.phase !== "return")
          .every((phase) => phase.station.modes.includes(mode)),
      ).toBe(true);
      if (mode === "seated") {
        expect(route[0].action).toContain("Stay seated if you prefer");
      } else {
        expect(route[0].action).toContain("within this room");
      }
    }
  });
});
