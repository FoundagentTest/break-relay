import { describe, expect, it } from "vitest";
import {
  createSession,
  markCueAnnounced,
  pauseSession,
  reconcileSession,
  remainingMs,
  resumeSession,
  shouldAnnounceCue,
  skipStep,
} from "./session";
import { buildRoute, STATION_PRESETS } from "./data";
import { loadSession, SESSION_STORAGE_KEY } from "./storage";
import type { RouteStep } from "./types";

function route(): RouteStep[] {
  return ["Window", "Water", "Return"].map((name, index) => ({
    id: `step-${index}`,
    station: {
      id: `station-${index}`,
      name,
      kind: "rest",
      detail: name,
      modes: ["any"],
    },
    action: `Action ${index}`,
    spokenCue: `Cue ${index}`,
    durationSeconds: 10,
    phase: index === 2 ? "return" : "arrive",
  }));
}

describe("wall-clock relay reconciliation", () => {
  it("jumps over missed cues to the single currently relevant step", () => {
    const started = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: true,
      keepAwake: false,
      now: 1_000,
      id: "clock",
    });

    const caughtUp = reconcileSession(started, 26_000);

    expect(caughtUp.currentStepIndex).toBe(2);
    expect(caughtUp.status).toBe("active");
    expect(shouldAnnounceCue(caughtUp)).toBe(true);
    const announced = markCueAnnounced(caughtUp, 26_000);
    expect(shouldAnnounceCue(announced)).toBe(false);
    expect(announced.lastAnnouncedStepId).toBe("step-2");
  });

  it("completes an elapsed relay at its deadline instead of inventing time", () => {
    const started = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: false,
      keepAwake: false,
      now: 5_000,
      id: "elapsed",
    });

    const elapsed = reconcileSession(started, 60_000);

    expect(elapsed.status).toBe("complete");
    expect(elapsed.completedAt).toBe(35_000);
    expect(remainingMs(elapsed, 60_000)).toBe(0);
  });

  it("cannot pause an already elapsed relay back into active state", () => {
    const started = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: false,
      keepAwake: true,
      now: 1_000,
      id: "late-pause",
    });

    const latePause = pauseSession(started, 40_000);

    expect(latePause.status).toBe("complete");
    expect(latePause.paused).toBe(false);
    expect(latePause.completedAt).toBe(31_000);
  });

  it("freezes both step and overall deadlines while paused", () => {
    const started = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: false,
      keepAwake: true,
      now: 10_000,
      id: "paused",
    });
    const paused = pauseSession(started, 14_000);
    const stillPaused = reconcileSession(paused, 114_000);
    const resumed = resumeSession(stillPaused, 114_000);

    expect(stillPaused.currentStepIndex).toBe(0);
    expect(remainingMs(stillPaused, 114_000)).toBe(26_000);
    expect(resumed.stepDeadlineAt).toBe(120_000);
    expect(resumed.deadlineAt).toBe(140_000);
    expect(resumed.paused).toBe(false);
  });

  it("persists a cue skip without changing the absolute boundary", () => {
    const started = markCueAnnounced(
      createSession({
        route: route(),
        durationMinutes: 1,
        audioEnabled: true,
        keepAwake: false,
        now: 1_000,
        id: "skip",
      }),
      1_000,
    );
    const skipped = skipStep(started, 4_000);

    expect(skipped.currentStepIndex).toBe(1);
    expect(skipped.stepDeadlineAt).toBe(14_000);
    expect(skipped.deadlineAt).toBe(31_000);
    expect(skipped.lastAnnouncedStepId).toBeNull();
    expect(skipped.skippedStepIds).toEqual(["step-0"]);
    expect(skipped.reachedStepIds).toEqual(["step-0", "step-1"]);
  });

  it("keeps the original pause anchor when a cue is skipped while paused", () => {
    const started = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: false,
      keepAwake: false,
      now: 1_000,
      id: "paused-skip",
    });
    const paused = pauseSession(started, 4_000);
    const skipped = skipStep(paused, 8_000);
    const resumed = resumeSession(skipped, 18_000);

    expect(skipped.pausedAt).toBe(4_000);
    expect(skipped.stepDeadlineAt).toBe(14_000);
    expect(resumed.stepDeadlineAt).toBe(28_000);
    expect(resumed.deadlineAt).toBe(45_000);
  });

  it("migrates a version-one active relay without losing recovery", () => {
    const current = createSession({
      route: route(),
      durationMinutes: 1,
      audioEnabled: false,
      keepAwake: false,
      now: 1_000,
      id: "legacy-active",
    });
    const {
      routeContext: _routeContext,
      skippedStepIds: _skippedStepIds,
      reachedStepIds: _reachedStepIds,
      ...legacy
    } = current;
    const legacyRoute = legacy.route.map(({ phase, ...step }) => ({
      ...step,
      kind: phase === "return" ? "return" : "station",
    }));
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ ...legacy, route: legacyRoute, version: 1 }),
    );

    const recovered = loadSession(2_000);

    expect(recovered).toMatchObject({
      version: 7,
      source: "local",
      id: "legacy-active",
      status: "active",
      currentStepIndex: 0,
      routeContext: null,
      skippedStepIds: [],
      reachedStepIds: ["step-0"],
      neutralStepIds: [],
      cueDeliveryFailed: false,
      wakeLockFailed: false,
    });
    expect(recovered?.route.every((step) => step.phase)).toBe(true);
  });

  it("keeps phases crossed during a visibility catch-up neutral", () => {
    const phases = buildRoute(
      [
        STATION_PRESETS.find((station) => station.id === "window")!,
        STATION_PRESETS.find((station) => station.id === "plant")!,
        STATION_PRESETS.find(
          (station) => station.id === "quiet-corner",
        )!,
      ],
      "eyes",
      7,
      18,
    );
    const started = createSession({
      route: phases,
      durationMinutes: 7,
      audioEnabled: false,
      keepAwake: false,
      now: 1_000,
      id: "visibility-catch-up",
    });
    const firstQuietIndex = phases.findIndex(
      (step) => step.phase === "quiet",
    );
    const firstQuietStart =
      1_000 +
      phases
        .slice(0, firstQuietIndex)
        .reduce(
          (total, step) => total + step.durationSeconds * 1_000,
          0,
        );

    const caughtUp = reconcileSession(started, firstQuietStart + 1_000);

    expect(caughtUp.currentStepIndex).toBe(firstQuietIndex);
    expect(caughtUp.reachedStepIds).toEqual([
      phases[firstQuietIndex].id,
    ]);
    expect(
      caughtUp.reachedStepIds,
    ).not.toContain(
      phases.find((step) => step.phase === "arrive")?.id,
    );
  });
});
