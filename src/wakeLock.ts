export interface WakeLockSentinelLike {
  readonly released?: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

export type WakeLockAttempt =
  | { ok: true; sentinel: WakeLockSentinelLike }
  | { ok: false; reason: "unsupported" | "hidden" | "rejected" };

export async function requestScreenWake(): Promise<WakeLockAttempt> {
  const wakeNavigator = navigator as Navigator & {
    wakeLock?: {
      request: (type: "screen") => Promise<WakeLockSentinelLike>;
    };
  };
  if (!wakeNavigator.wakeLock) {
    return { ok: false, reason: "unsupported" };
  }
  if (document.visibilityState !== "visible") {
    return { ok: false, reason: "hidden" };
  }
  try {
    const sentinel = await wakeNavigator.wakeLock.request("screen");
    if (sentinel.released) {
      return { ok: false, reason: "rejected" };
    }
    return { ok: true, sentinel };
  } catch {
    return { ok: false, reason: "rejected" };
  }
}

export async function releaseScreenWake(
  sentinel: WakeLockSentinelLike | null,
) {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    // A browser may release it first when visibility changes.
  }
}
