import { beforeEach, describe, expect, it } from "vitest";
import { buildExtension, buildRoute, STATION_PRESETS } from "./data";
import {
  completeSession,
  createSession,
  reconcileSession,
  replaceWithExtension,
  skipStep,
} from "./session";
import {
  appendRouteHistory,
  createRouteHistoryEntry,
  emptyRouteMemory,
  loadRouteMemory,
  MAX_ROUTE_HISTORY,
  ROUTE_MEMORY_STORAGE_KEY,
  saveRouteMemory,
} from "./routeMemory";
import type {
  Feeling,
  RouteHistoryEntry,
  RouteOutcome,
  RouteStep,
  SpaceMode,
} from "./types";

function historyEntry({
  id,
  route,
  outcome,
  completedAt,
  feeling = "noise",
  spaceMode = "any",
}: {
  id: string;
  route: RouteStep[];
  outcome: RouteOutcome;
  completedAt: number;
  feeling?: Feeling;
  spaceMode?: SpaceMode;
}): RouteHistoryEntry {
  return {
    version: 2,
    spaceId: "space-default",
    id,
    feeling,
    durationMinutes: 5,
    spaceMode,
    steps: route
      .filter(
        (step) =>
          step.phase === "arrive" ||
          (step.phase === "quiet" &&
            step.station.id !== "comfortable-pause"),
      )
      .map((step) => ({
        stepId: step.id,
        stationId: step.station.id,
        stationName: step.station.name,
        action: step.action,
        used: true,
        skipped: false,
      })),
    extensionUsed: false,
    endedEarly: false,
    outcome,
    completedAt,
  };
}

describe("local route memory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("bounds saved history and replaces duplicate session records", () => {
    let memory = emptyRouteMemory();
    for (let index = 0; index < MAX_ROUTE_HISTORY + 8; index += 1) {
      memory = appendRouteHistory(
        memory,
        historyEntry({
          id: `route-${index}`,
          route: buildRoute(STATION_PRESETS.slice(0, 3), "noise", 5, index),
          outcome: index % 2 === 0 ? "useful" : "not_fit",
          completedAt: index,
        }),
      );
    }
    const replacement = {
      ...memory.entries.at(-1)!,
      outcome: "unrated" as const,
      completedAt: 100,
    };
    memory = appendRouteHistory(memory, replacement);
    saveRouteMemory(memory);

    const loaded = loadRouteMemory();
    expect(loaded.entries).toHaveLength(MAX_ROUTE_HISTORY);
    expect(loaded.entries[0].id).toBe("route-8");
    expect(loaded.entries.at(-1)).toMatchObject({
      id: replacement.id,
      outcome: "unrated",
      completedAt: 100,
    });
    expect(
      loaded.entries.filter((entry) => entry.id === replacement.id),
    ).toHaveLength(1);
  });

  it("migrates a legacy array, drops malformed entries, and recovers from corruption", () => {
    const route = buildRoute(STATION_PRESETS.slice(0, 3), "noise", 5, 4);
    const valid = historyEntry({
      id: "legacy",
      route,
      outcome: "useful",
      completedAt: 20,
    });
    const legacy = {
      ...valid,
      version: 0,
      durationMinutes: undefined,
      duration: 5,
      outcome: "worked",
      steps: valid.steps.map(({ stepId, ...step }) => ({
        ...step,
        id: stepId,
      })),
    };
    localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify([legacy, { id: "broken" }]),
    );

    const migrated = loadRouteMemory();
    expect(migrated).toMatchObject({
      version: 2,
      entries: [
        {
          version: 2,
          id: "legacy",
          durationMinutes: 5,
          outcome: "useful",
        },
      ],
    });

    localStorage.setItem(ROUTE_MEMORY_STORAGE_KEY, "{not-json");
    expect(loadRouteMemory()).toEqual(emptyRouteMemory());
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
  });

  it("keeps original route context, skips, and extension use in the outcome record", () => {
    const route = buildRoute(STATION_PRESETS.slice(0, 3), "eyes", 5, 8);
    const context = {
      feeling: "eyes" as const,
      spaceMode: "any" as const,
      steps: route
        .filter(
          (step) =>
            step.phase === "arrive" ||
            (step.phase === "quiet" &&
              step.station.id !== "comfortable-pause"),
        )
        .map((step) => ({
        stepId: step.id,
        stationId: step.station.id,
        stationName: step.station.name,
        action: step.action,
      })),
    };
    const started = createSession({
      route,
      durationMinutes: 5,
      audioEnabled: false,
      keepAwake: false,
      routeContext: context,
      now: 1_000,
      id: "extended",
    });
    const atArrival = reconcileSession(started, started.stepDeadlineAt);
    const skipped = skipStep(atArrival, started.stepDeadlineAt + 1_000);
    const atBoundary = reconcileSession(skipped, skipped.deadlineAt);
    const extension = replaceWithExtension(
      atBoundary,
      [buildExtension("eyes")],
      4_000,
    );
    const finished = completeSession(extension, false, 5_000);

    const entry = createRouteHistoryEntry(
      finished,
      { feeling: "noise", spaceMode: "seated" },
      "useful",
      6_000,
    );

    expect(entry).toMatchObject({
      id: "extended",
      feeling: "eyes",
      durationMinutes: 5,
      spaceMode: "any",
      extensionUsed: true,
      outcome: "useful",
      completedAt: 6_000,
    });
    expect(entry?.steps).toHaveLength(2);
    expect(entry?.steps[0].skipped).toBe(true);
    expect(entry?.steps[0].used).toBe(false);
    expect(entry?.steps[1].skipped).toBe(false);
    expect(entry?.steps[1].used).toBe(true);
  });

  it("leaves action phases crossed during recovery neutral", () => {
    const route = buildRoute(
      [
        STATION_PRESETS.find((station) => station.id === "window")!,
        STATION_PRESETS.find((station) => station.id === "plant")!,
        STATION_PRESETS.find(
          (station) => station.id === "quiet-corner",
        )!,
      ],
      "noise",
      7,
      61,
    );
    const context = {
      feeling: "noise" as const,
      spaceMode: "any" as const,
      steps: route
        .filter(
          (step) =>
            step.phase === "arrive" || step.phase === "quiet",
        )
        .map((step) => ({
          stepId: step.id,
          stationId: step.station.id,
          stationName: step.station.name,
          action: step.action,
        })),
    };
    const started = createSession({
      route,
      durationMinutes: 7,
      audioEnabled: false,
      keepAwake: false,
      routeContext: context,
      now: 1_000,
      id: "missed-actions",
    });
    const quietIndex = route.findIndex(
      (step) => step.phase === "quiet",
    );
    const quietStartedAt =
      1_000 +
      route
        .slice(0, quietIndex)
        .reduce(
          (total, step) => total + step.durationSeconds * 1_000,
          0,
        );
    const caughtUp = reconcileSession(started, quietStartedAt + 1_000);
    const finished = completeSession(caughtUp, true, quietStartedAt + 2_000);
    const entry = createRouteHistoryEntry(
      finished,
      { feeling: "noise", spaceMode: "any" },
      "useful",
      quietStartedAt + 3_000,
    );

    expect(entry?.steps.find((step) =>
      step.stepId.includes("-arrive"),
    )?.used).toBe(false);
    expect(entry?.steps.find((step) =>
      step.stepId.endsWith("quiet-1"),
    )?.used).toBe(true);
    expect(entry?.steps.find((step) =>
      step.stepId.endsWith("quiet-2"),
    )?.used).toBe(false);
  });
});

describe("adaptive route assembly", () => {
  const stations = [
    STATION_PRESETS.find((station) => station.id === "window")!,
    STATION_PRESETS.find((station) => station.id === "plant")!,
    STATION_PRESETS.find((station) => station.id === "quiet-corner")!,
    STATION_PRESETS.find((station) => station.id === "water")!,
    STATION_PRESETS.find((station) => station.id === "doorway")!,
    STATION_PRESETS.find((station) => station.id === "clear-floor")!,
  ];

  it("is deterministic without history and uses only configured, mode-safe stations", () => {
    const first = buildRoute(stations, "air", 7, 2026, {
      history: [],
      spaceMode: "seated",
    });
    const second = buildRoute(stations, "air", 7, 2026, {
      history: [],
      spaceMode: "seated",
    });

    expect(second).toEqual(first);
    expect(first.at(-1)?.phase).toBe("return");
    expect(
      first
        .filter((step) => step.phase !== "return")
        .every(
          (step) =>
            stations.some((station) => station.id === step.station.id) &&
            step.station.modes.includes("seated"),
        ),
    ).toBe(true);
    expect(
      first.reduce((total, step) => total + step.durationSeconds, 0),
    ).toBe(7 * 60);
  });

  it("weights explicit feedback most in a similar context", () => {
    const targetRoute = buildRoute([stations[0]], "noise", 5, 2);
    const preferredAction = targetRoute[0].action;
    const neutralRecent = historyEntry({
      id: "recent-other",
      route: buildRoute([stations[1]], "noise", 5, 9),
      outcome: "unrated",
      completedAt: 100,
    });
    const usefulHistory = [
      ...Array.from({ length: 8 }, (_, index) =>
        historyEntry({
          id: `useful-${index}`,
          route: targetRoute,
          outcome: "useful",
          completedAt: index + 1,
        }),
      ),
      neutralRecent,
    ];
    const notFitHistory = [
      ...Array.from({ length: 8 }, (_, index) =>
        historyEntry({
          id: `not-fit-${index}`,
          route: targetRoute,
          outcome: "not_fit",
          completedAt: index + 1,
        }),
      ),
      neutralRecent,
    ];

    function countTarget(
      history: RouteHistoryEntry[],
      feeling: Feeling,
      spaceMode: SpaceMode,
    ) {
      let stationCount = 0;
      let actionCount = 0;
      for (let seed = 0; seed < 80; seed += 1) {
        const route = buildRoute(stations, feeling, 5, seed, {
          history,
          spaceMode,
        });
        const target = route.find(
          (step) => step.station.id === stations[0].id,
        );
        if (target) stationCount += 1;
        if (target?.action === preferredAction) actionCount += 1;
      }
      return { stationCount, actionCount };
    }

    const baseline = countTarget([], "noise", "any");
    const similarUseful = countTarget(usefulHistory, "noise", "any");
    const differentBaseline = countTarget([], "eyes", "any");
    const differentContext = countTarget(usefulHistory, "eyes", "any");
    const similarNotFit = countTarget(notFitHistory, "noise", "any");

    expect(similarUseful.stationCount).toBeGreaterThan(baseline.stationCount);
    expect(similarUseful.actionCount).toBeGreaterThan(baseline.actionCount);
    expect(
      similarUseful.stationCount - baseline.stationCount,
    ).toBeGreaterThan(
      differentContext.stationCount - differentBaseline.stationCount,
    );
    expect(similarNotFit.stationCount).toBeLessThan(baseline.stationCount);
  });

  it("avoids immediately repeating route order and action copy", () => {
    const first = buildRoute(stations, "air", 5, 77);
    const recent = historyEntry({
      id: "most-recent",
      route: first,
      outcome: "useful",
      completedAt: 100,
      feeling: "air",
    });
    const next = buildRoute(stations, "air", 5, 77, {
      history: [recent],
      spaceMode: "any",
    });
    const firstStations = first
      .filter((step) => step.phase === "move")
      .map((step) => step.station.id);
    const nextStations = next
      .filter((step) => step.phase === "move")
      .map((step) => step.station.id);

    expect(nextStations).not.toEqual(firstStations);
    for (const step of next.filter((item) => item.phase === "arrive")) {
      const prior = first.find(
        (item) =>
          item.phase === "arrive" &&
          item.station.id === step.station.id,
      );
      if (prior) expect(step.action).not.toBe(prior.action);
    }
  });

  it("retains deterministic exploration after repeated not-fit feedback", () => {
    const targetRoute = buildRoute([stations[0]], "noise", 5, 3);
    const history = Array.from({ length: MAX_ROUTE_HISTORY }, (_, index) =>
      historyEntry({
        id: `negative-${index}`,
        route: targetRoute,
        outcome: "not_fit",
        completedAt: index,
      }),
    );
    const appearances = Array.from({ length: 120 }, (_, seed) =>
      buildRoute(stations, "noise", 5, seed, {
        history,
        spaceMode: "any",
      }).some((step) => step.station.id === stations[0].id),
    ).filter(Boolean).length;

    expect(appearances).toBeGreaterThan(0);
    expect(appearances).toBeLessThan(120);
    expect(
      buildRoute(stations, "noise", 5, 19, {
        history,
        spaceMode: "any",
      }),
    ).toEqual(
      buildRoute(stations, "noise", 5, 19, {
        history,
        spaceMode: "any",
      }),
    );
  });
});
