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

function realArrivals(route: RouteStep[]) {
  return route.filter((step) => step.phase === "arrive");
}

function expectedPlaces(
  duration: (typeof durations)[number],
  mode: SpaceMode,
  eligible: number,
) {
  if (duration === 5 || mode === "seated") return 1;
  if (mode === "small") return duration === 10 ? Math.min(2, eligible) : 1;
  return Math.min(duration === 10 ? 3 : 2, eligible);
}

describe("purposeful relay composition", () => {
  it("is deterministic, exact, mode-safe, and sparse across every boundary and movement mode", () => {
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
            expect(route.at(-1)).toMatchObject({
              phase: "return",
              station: { id: "desk-return", name: "Return window" },
            });
            expect(realArrivals(route)).toHaveLength(
              expectedPlaces(duration, mode, stations.length),
            );
            expect(route.filter((step) => step.phase === "quiet")).toHaveLength(
              1,
            );
            expect(new Set(route.map((step) => step.id)).size).toBe(route.length);
            expect(
              route
                .filter(
                  (step) =>
                    step.station.id !== "comfortable-pause" &&
                    step.station.id !== "desk-return",
                )
                .every(
                  (step) =>
                    stations.some(
                      (station) => station.id === step.station.id,
                    ) && step.station.modes.includes(mode),
                ),
            ).toBe(true);
          }
        }
      }
    }
  });

  it("turns the reported Water + Window + Hallway case into a quick-to-quiet relay", () => {
    const stations = ["window", "water", "hallway"].map(
      (id) => STATION_PRESETS.find((station) => station.id === id)!,
    );

    const seven = buildRoute(stations, "noise", 7, 2026);
    const sevenArrivals = realArrivals(seven);
    expect(sevenArrivals).toHaveLength(2);
    expect(["water", "hallway"]).toContain(sevenArrivals[0].station.id);
    expect(sevenArrivals[1].station.id).toBe("window");
    expect(seven.filter((step) => step.phase === "quiet")).toEqual([
      expect.objectContaining({
        station: expect.objectContaining({ id: "window" }),
      }),
    ]);
    expect(
      seven.some((step) => step.station.id === "comfortable-pause"),
    ).toBe(false);
    expect(totalSeconds(seven)).toBe(420);

    const ten = buildRoute(stations, "noise", 10, 2026);
    expect(realArrivals(ten).map((step) => step.station.id).at(-1)).toBe(
      "window",
    );
    expect(new Set(realArrivals(ten).map((step) => step.station.id))).toEqual(
      new Set(["window", "water", "hallway"]),
    );
    expect(totalSeconds(ten)).toBe(600);
  });

  it("keeps five-minute and constrained routes appropriately sparse", () => {
    for (const mode of modes) {
      const stations = presetsFor(mode).slice(0, 6);
      const five = buildRoute(stations, "eyes", 5, 18, {
        spaceMode: mode,
      });
      expect(realArrivals(five)).toHaveLength(1);
      expect(five.filter((step) => step.phase === "move")).toHaveLength(1);
    }

    const seated = presetsFor("seated").slice(0, 6);
    for (const duration of durations) {
      const route = buildRoute(seated, "stiff", duration, 91, {
        spaceMode: "seated",
      });
      expect(realArrivals(route)).toHaveLength(1);
      expect(route[0].action).toContain("staying seated if you prefer");
      expect(totalSeconds(route)).toBe(duration * 60);
    }

    const small = presetsFor("small").slice(0, 6);
    expect(
      realArrivals(
        buildRoute(small, "stiff", 7, 91, { spaceMode: "small" }),
      ),
    ).toHaveLength(1);
    expect(
      realArrivals(
        buildRoute(small, "stiff", 10, 91, { spaceMode: "small" }),
      ),
    ).toHaveLength(2);
  });

  it("uses one honest no-travel carry only when no configured quiet carrier exists", () => {
    const customStations: Station[] = Array.from(
      { length: 4 },
      (_, index) => ({
        id: `custom-${index}`,
        name: `Custom place ${index + 1}`,
        kind: "custom",
        detail: "A user-named reachable place",
        modes: ["any", "small", "seated"],
        custom: true,
      }),
    );
    const utilityStations = ["water", "doorway", "clear-floor", "hallway"].map(
      (id) => STATION_PRESETS.find((station) => station.id === id)!,
    );

    for (const stations of [customStations, utilityStations]) {
      for (const duration of durations) {
        const route = buildRoute(stations, "air", duration, 83);
        const fallback = route.filter(
          (step) => step.station.id === "comfortable-pause",
        );
        expect(fallback).toHaveLength(1);
        expect(fallback[0]).toMatchObject({
          phase: "quiet",
          station: { name: "No-travel pause" },
        });
        expect(fallback[0].spokenCue).toContain(
          "No quiet-capable place remains",
        );
        expect(totalSeconds(route)).toBe(duration * 60);
      }
    }
  });

  it("makes every stage cue distinct and leaves one explicit return window", () => {
    const stations = ["water", "hallway", "window"].map(
      (id) => STATION_PRESETS.find((station) => station.id === id)!,
    );
    const route = buildRoute(stations, "noise", 10, 54);

    expect(new Set(route.map((step) => step.spokenCue)).size).toBe(route.length);
    expect(new Set(route.map((step) => step.action)).size).toBe(route.length);
    expect(route.filter((step) => step.phase === "return")).toHaveLength(1);
    expect(route.at(-1)?.durationSeconds).toBe(70);
    expect(route.at(-1)?.spokenCue).toContain("break boundary");
    expect(
      route.find((step) => step.phase === "quiet")?.spokenCue,
    ).toContain("No screen check is needed");
  });
});
