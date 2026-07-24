import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRelayCapabilities,
  playCueSignal,
  speakCue,
} from "./capabilities";
import {
  releaseScreenWake,
  requestScreenWake,
} from "./wakeLock";

const originalAudio = window.Audio;
const originalSpeech = window.speechSynthesis;
const originalUtterance = window.SpeechSynthesisUtterance;
const originalWake = Object.getOwnPropertyDescriptor(
  navigator,
  "wakeLock",
);

class PlayingAudio extends EventTarget {
  static sources: string[] = [];
  preload = "";
  volume = 1;

  constructor(public src: string) {
    super();
    PlayingAudio.sources.push(src);
  }

  async play() {
    this.dispatchEvent(new Event("playing"));
  }
}

afterEach(() => {
  Object.defineProperty(window, "Audio", {
    configurable: true,
    value: originalAudio,
  });
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: originalAudio,
  });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: originalSpeech,
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: originalUtterance,
  });
  if (originalWake) {
    Object.defineProperty(navigator, "wakeLock", originalWake);
  } else {
    Reflect.deleteProperty(navigator, "wakeLock");
  }
  PlayingAudio.sources = [];
});

describe("verified local cue delivery", () => {
  it("confirms real playing callbacks and uses a distinct bundled return sound", async () => {
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: PlayingAudio,
    });
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: PlayingAudio,
    });

    await expect(playCueSignal("phase")).resolves.toEqual({ ok: true });
    await expect(playCueSignal("return")).resolves.toEqual({ ok: true });

    expect(PlayingAudio.sources).toHaveLength(2);
    expect(PlayingAudio.sources[0]).toMatch(/^data:audio\/wav;base64,/);
    expect(PlayingAudio.sources[1]).toMatch(/^data:audio\/wav;base64,/);
    expect(PlayingAudio.sources[0]).not.toBe(PlayingAudio.sources[1]);
  });

  it("reports a rejected play promise instead of trusting Audio presence", async () => {
    class BlockedAudio extends EventTarget {
      preload = "";
      volume = 1;
      constructor(public src: string) {
        super();
      }
      async play() {
        throw new DOMException("blocked", "NotAllowedError");
      }
    }
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: BlockedAudio,
    });
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: BlockedAudio,
    });

    expect(getRelayCapabilities().audio).toBe(true);
    await expect(playCueSignal("phase")).resolves.toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("treats speech API presence as unverified when its dispatcher errors", () => {
    const onError = vi.fn();
    const onStart = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: (utterance: SpeechSynthesisUtterance) =>
          utterance.onerror?.({
            error: "synthesis-failed",
          } as SpeechSynthesisErrorEvent),
      },
    });

    expect(getRelayCapabilities().speech).toBe(true);
    expect(speakCue("check", { onError, onStart })).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("only verifies speech after an actual start callback", () => {
    const onStart = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: (utterance: SpeechSynthesisUtterance) =>
          utterance.onstart?.(
            new Event("start") as SpeechSynthesisEvent,
          ),
      },
    });

    speakCue("check", { onStart });
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe("screen wake acquisition", () => {
  it("returns and releases an observed wake sentinel", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const sentinel = {
      released: false,
      release,
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: vi.fn().mockResolvedValue(sentinel),
      },
    });

    const result = await requestScreenWake();
    expect(result).toEqual({ ok: true, sentinel });
    if (result.ok) await releaseScreenWake(result.sentinel);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("reports wake rejection before a session can depart", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });

    await expect(requestScreenWake()).resolves.toEqual({
      ok: false,
      reason: "rejected",
    });
  });
});
