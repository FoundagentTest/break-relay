import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  onerror: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class MockAudio extends EventTarget {
  preload = "";
  volume = 1;
  src: string;

  constructor(src = "") {
    super();
    this.src = src;
  }

  play = vi.fn(async () => {
    this.dispatchEvent(new Event("playing"));
  });

  pause = vi.fn();
}

Object.defineProperty(window, "Audio", {
  configurable: true,
  value: MockAudio,
});

Object.defineProperty(globalThis, "Audio", {
  configurable: true,
  value: MockAudio,
});

Object.defineProperty(window, "SpeechSynthesisUtterance", {
  configurable: true,
  value: MockSpeechSynthesisUtterance,
});

Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
  configurable: true,
  value: MockSpeechSynthesisUtterance,
});

Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: {
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      utterance.onstart?.(
        new Event("start") as SpeechSynthesisEvent,
      );
    }),
  },
});

Object.defineProperty(navigator, "vibrate", {
  configurable: true,
  value: vi.fn(),
});
