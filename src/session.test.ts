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
    kind: index === 2 ? "return" : "station",
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

  it("persists a skip as a new exact boundary without replay eligibility", () => {
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
    expect(skipped.deadlineAt).toBe(24_000);
    expect(skipped.lastAnnouncedStepId).toBeNull();
  });
});
