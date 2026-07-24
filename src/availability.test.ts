import { beforeEach, describe, expect, it } from "vitest";
import {
  availableStations,
  buildNoTravelRoute,
  buildReplacementRoute,
  buildRoute,
  STATION_PRESETS,
} from "./data";
import { createRouteHistoryEntry } from "./routeMemory";
import {
  completeSession,
  createSession,
  markCueAnnounced,
  recomposeSession,
  reconcileSession,
  remainingMs,
  shouldAnnounceCue,
} from "./session";
import {
  loadSession,
  saveSession,
} from "./storage";
import type {
  ActiveSession,
  RouteStep,
  Station,
} from "./types";

const stations = ["window", "plant", "quiet-corner"].map(
  (id) => STATION_PRESETS.find((station) => station.id === id)!,
);

function learnableContext(route: RouteStep[]) {
  return {
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
}

function sessionFor(route: RouteStep[], eligibleStations = stations) {
  return createSession({
    route,
    durationMinutes: 7,
    audioEnabled: true,
    keepAwake: false,
    routeContext: learnableContext(route),
    eligibleStations,
    now: 1_000,
    id: "availability-session",
  });
}

function atPhase(session: ActiveSession, phase: RouteStep["phase"]) {
  const index = session.route.findIndex((step) => step.phase === phase);
  const phaseStartedAt =
    session.startedAt +
    session.route
      .slice(0, index)
      .reduce(
        (total, step) => total + step.durationSeconds * 1_000,
        0,
      );
  return reconcileSession(session, phaseStartedAt);
}

function replacementFor(
  session: ActiveSession,
  alternatives: Station[],
  now: number,
) {
  return buildReplacementRoute(
    alternatives,
    "eyes",
    session.durationMinutes,
    Math.ceil(remainingMs(session, now) / 1_000),
    9_000 + session.rerouteCount,
    {
      revision: session.rerouteCount + 1,
      spaceMode: "any",
    },
  ).route;
}

describe("temporary place availability", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses temporary exclusions without changing the saved compatible set", () => {
    const saved = [...stations];
    const active = availableStations(saved, "any", [
      "window",
      "quiet-corner",
    ]);

    expect(active.map((station) => station.id)).toEqual(["plant"]);
    expect(saved.map((station) => station.id)).toEqual([
      "window",
      "plant",
      "quiet-corner",
    ]);
    expect(buildRoute(active, "eyes", 5, 41)).toHaveLength(4);
  });

  it("composes an exact no-travel route when zero places are active", () => {
    const route = buildNoTravelRoute("stiff", 5, "seated");

    expect(route[0]).toMatchObject({
      phase: "quiet",
      station: { id: "comfortable-pause" },
    });
    expect(route.at(-1)?.phase).toBe("return");
    expect(
      route.reduce((total, step) => total + step.durationSeconds, 0),
    ).toBe(300);
    expect(route[0].spokenCue).toMatch(/^No travel is needed/);
  });

  it.each(["move", "arrive", "quiet"] as const)(
    "recomposes from the %s phase without replaying the rejected place",
    (phase) => {
      const route = buildRoute(stations, "eyes", 7, 27);
      const started = markCueAnnounced(sessionFor(route), 1_000);
      const current = atPhase(started, phase);
      const rejected = current.route[current.currentStepIndex].station;
      const alternatives = stations.filter(
        (station) => station.id !== rejected.id,
      );
      const now = Math.min(
        current.stepDeadlineAt - 1,
        current.deadlineAt - 1,
      );
      const replacement = replacementFor(current, alternatives, now);
      const rerouted = recomposeSession(
        current,
        replacement,
        rejected.id,
        now,
      );

      expect(rerouted.id).toBe(started.id);
      expect(rerouted.deadlineAt).toBe(started.deadlineAt);
      expect(rerouted.currentStepIndex).toBe(0);
      expect(rerouted.route[0].phase).toBe("move");
      expect(rerouted.route[0].station.id).not.toBe(rejected.id);
      expect(rerouted.route.every(
        (step) => step.station.id !== rejected.id,
      )).toBe(true);
      expect(rerouted.lastAnnouncedStepId).toBeNull();
      expect(shouldAnnounceCue(rerouted)).toBe(true);
      const announced = markCueAnnounced(rerouted, now);
      expect(shouldAnnounceCue(announced)).toBe(false);
      expect(announced.lastAnnouncedStepId).toContain("reroute-1");
    },
  );

  it("uses a comfortable pause when no alternative remains", () => {
    const only = stations[0];
    const route = buildRoute([only], "eyes", 5, 8);
    const started = createSession({
      route,
      durationMinutes: 5,
      audioEnabled: false,
      keepAwake: false,
      routeContext: learnableContext(route),
      eligibleStations: [only],
      now: 2_000,
      id: "one-place",
    });
    const replacement = replacementFor(started, [], 3_000);
    const rerouted = recomposeSession(
      started,
      replacement,
      only.id,
      3_000,
    );

    expect(rerouted.deadlineAt).toBe(started.deadlineAt);
    expect(rerouted.route[0]).toMatchObject({
      phase: "quiet",
      station: { id: "comfortable-pause" },
    });
    expect(rerouted.route.some(
      (step) => step.station.id === only.id,
    )).toBe(false);
  });

  it("bounds repeated replacement and never cycles to a rejected place", () => {
    const route = buildRoute(stations, "eyes", 7, 18);
    let current = sessionFor(route);
    const rejected = new Set<string>();

    for (let revision = 1; revision <= stations.length; revision += 1) {
      const stationId =
        current.route[current.currentStepIndex].station.id;
      rejected.add(stationId);
      const alternatives = current.eligibleStations.filter(
        (station) => !rejected.has(station.id),
      );
      const now = 1_000 + revision * 1_000;
      current = recomposeSession(
        current,
        replacementFor(current, alternatives, now),
        stationId,
        now,
      );
      const nextDestination = current.route.find(
        (step) => step.phase === "move",
      )?.station.id;
      if (nextDestination) expect(rejected.has(nextDestination)).toBe(false);
    }

    expect(current.rerouteCount).toBe(stations.length);
    expect(current.route[0].station.id).toBe("comfortable-pause");
    const unchanged = recomposeSession(
      current,
      buildNoTravelRoute("eyes", 5, "any", 4),
      "comfortable-pause",
      5_000,
    );
    expect(unchanged).toBe(current);
  });

  it("recovers a recomposed route with its identity, clock, and cue state", () => {
    const route = buildRoute(stations, "eyes", 7, 33);
    const started = sessionFor(route);
    const rejected = route[0].station.id;
    const replacement = replacementFor(
      started,
      stations.filter((station) => station.id !== rejected),
      2_000,
    );
    const rerouted = markCueAnnounced(
      recomposeSession(started, replacement, rejected, 2_000),
      2_000,
    );
    saveSession(rerouted);

    const recovered = loadSession(2_500);

    expect(recovered).toMatchObject({
      version: 5,
      id: started.id,
      deadlineAt: started.deadlineAt,
      rerouteCount: 1,
      currentStepIndex: 0,
      lastAnnouncedStepId: rerouted.route[0].id,
      unavailableStationIds: [rejected],
    });
    expect(recovered?.route).toEqual(rerouted.route);
    expect(shouldAnnounceCue(recovered!)).toBe(false);
  });

  it("keeps rejected and unreached phases neutral, learns reached replacements, and clears temporary state", () => {
    const route = buildRoute(stations, "eyes", 7, 71);
    const started = sessionFor(route);
    const rejected = route[0].station.id;
    const replacement = replacementFor(
      started,
      stations.filter((station) => station.id !== rejected),
      2_000,
    );
    const rerouted = recomposeSession(
      started,
      replacement,
      rejected,
      2_000,
    );
    const atReplacementArrival = reconcileSession(
      rerouted,
      rerouted.stepDeadlineAt,
    );
    const finished = completeSession(
      atReplacementArrival,
      true,
      rerouted.stepDeadlineAt + 1_000,
    );
    const history = createRouteHistoryEntry(
      finished,
      { feeling: "eyes", spaceMode: "any" },
      "useful",
      rerouted.stepDeadlineAt + 2_000,
    )!;

    expect(
      history.steps
        .filter((step) => step.stationId === rejected)
        .every((step) => !step.used && !step.skipped),
    ).toBe(true);
    expect(
      history.steps.find(
        (step) =>
          step.stepId.includes("reroute-1") &&
          step.stepId.includes("-arrive"),
      ),
    ).toMatchObject({ used: true, skipped: false });
    expect(
      history.steps
        .filter((step) => !finished.reachedStepIds.includes(step.stepId))
        .every((step) => !step.used),
    ).toBe(true);
    expect(finished.eligibleStations).toEqual([]);
    expect(finished.unavailableStationIds).toEqual([]);
    expect(finished.neutralStepIds.length).toBeGreaterThan(0);
  });
});
