import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CHECK_MAX_AGE_MS,
  capabilitySignature,
  formatLocalReturnTime,
  freshCapabilityCheck,
  recentCapabilitySnapshot,
  returnTimeBackupText,
} from "./readiness";
import type { LaunchCapabilitySnapshot } from "./types";

function verifiedAt(checkedAt: number): LaunchCapabilitySnapshot {
  return {
    speech: true,
    wakeLock: false,
    checkedAt,
    signature: capabilitySignature(),
    chimeVerified: true,
    audibilityConfirmed: true,
    visualOnlyAcknowledged: false,
    speechVerified: false,
    wakeVerified: false,
  };
}

describe("remembered device readiness", () => {
  it("keeps a recent verified chime eligible for one-action launch", () => {
    const now = 2_000_000_000_000;
    expect(
      freshCapabilityCheck(verifiedAt(now - 60_000), {
        cueSoundEnabled: true,
        keepAwake: false,
        now,
      }),
    ).toBe(true);
  });

  it("invalidates stale, future, and signature-mismatched checks", () => {
    const now = 2_000_000_000_000;
    expect(
      freshCapabilityCheck(
        verifiedAt(now - CAPABILITY_CHECK_MAX_AGE_MS - 1),
        { cueSoundEnabled: true, keepAwake: false, now },
      ),
    ).toBe(false);
    expect(
      freshCapabilityCheck(verifiedAt(now + 1), {
        cueSoundEnabled: true,
        keepAwake: false,
        now,
      }),
    ).toBe(false);
    expect(
      freshCapabilityCheck(
        { ...verifiedAt(now), signature: "changed-device" },
        { cueSoundEnabled: true, keepAwake: false, now },
      ),
    ).toBe(false);
  });

  it("does not treat old transport-only playback evidence as audible", () => {
    const now = 2_000_000_000_000;
    const oldSnapshot = {
      ...verifiedAt(now),
      audibilityConfirmed: undefined,
    };

    expect(
      freshCapabilityCheck(oldSnapshot, {
        cueSoundEnabled: true,
        keepAwake: false,
        now,
      }),
    ).toBe(false);
  });

  it("shares one freshness boundary across chime, speech, and wake labels", () => {
    const now = 2_000_000_000_000;
    expect(recentCapabilitySnapshot(verifiedAt(now), now)).toBe(true);
    expect(
      recentCapabilitySnapshot(
        verifiedAt(now - CAPABILITY_CHECK_MAX_AGE_MS - 1),
        now,
      ),
    ).toBe(false);
  });

  it("requires acknowledged visual-only and verified chosen wake modes", () => {
    const now = Date.now();
    const snapshot = verifiedAt(now);
    expect(
      freshCapabilityCheck(snapshot, {
        cueSoundEnabled: false,
        keepAwake: false,
        now,
      }),
    ).toBe(false);
    expect(
      freshCapabilityCheck(
        { ...snapshot, visualOnlyAcknowledged: true },
        { cueSoundEnabled: false, keepAwake: false, now },
      ),
    ).toBe(true);
    expect(
      freshCapabilityCheck(snapshot, {
        cueSoundEnabled: true,
        keepAwake: true,
        now,
      }),
    ).toBe(false);
  });
});

describe("exact return-time backup", () => {
  it("uses the same precise local wall-clock value in display and copy text", () => {
    const deadline = Date.UTC(2030, 0, 2, 12, 34);
    const shown = formatLocalReturnTime(deadline);
    const backup = returnTimeBackupText(deadline, 7);

    expect(backup).toContain(shown);
    expect(backup).toContain("7-minute device timer");
    expect(backup).toContain("has not created an alarm or notification");
  });
});
