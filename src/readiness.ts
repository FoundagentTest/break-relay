import { getRelayCapabilities } from "./capabilities";
import type { LaunchCapabilitySnapshot } from "./types";

export const CAPABILITY_CHECK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export function capabilitySignature() {
  const capabilities = getRelayCapabilities();
  return [
    capabilities.audio ? "audio" : "no-audio",
    capabilities.speech ? "speech-api" : "no-speech-api",
    capabilities.wakeLock ? "wake" : "no-wake",
  ].join(":");
}

export function recentCapabilitySnapshot(
  snapshot: LaunchCapabilitySnapshot | null,
  now = Date.now(),
) {
  return Boolean(
    snapshot &&
      typeof snapshot.checkedAt === "number" &&
      now - snapshot.checkedAt <= CAPABILITY_CHECK_MAX_AGE_MS &&
      now >= snapshot.checkedAt &&
      snapshot.signature === capabilitySignature(),
  );
}

export function freshCapabilityCheck(
  snapshot: LaunchCapabilitySnapshot | null,
  {
    cueSoundEnabled,
    keepAwake,
    now = Date.now(),
  }: {
    cueSoundEnabled: boolean;
    keepAwake: boolean;
    now?: number;
  },
) {
  if (!recentCapabilitySnapshot(snapshot, now) || !snapshot) return false;
  if (
    cueSoundEnabled &&
    (!snapshot.chimeVerified || !snapshot.audibilityConfirmed)
  ) {
    return false;
  }
  if (!cueSoundEnabled && !snapshot.visualOnlyAcknowledged) return false;
  if (keepAwake && !snapshot.wakeVerified) return false;
  return true;
}

export function formatLocalReturnTime(deadlineAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(deadlineAt));
}

export function returnTimeBackupText(
  deadlineAt: number,
  durationMinutes: number,
) {
  return `Break Relay return time: ${formatLocalReturnTime(
    deadlineAt,
  )}. If you need a locked-screen alert, set a ${durationMinutes}-minute device timer now. Break Relay has not created an alarm or notification.`;
}
