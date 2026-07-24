import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  onerror: ((event: Event) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

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
    speak: vi.fn(),
  },
});

Object.defineProperty(navigator, "vibrate", {
  configurable: true,
  value: vi.fn(),
});
