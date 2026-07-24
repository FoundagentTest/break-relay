import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildRoute, STATION_PRESETS } from "./data";
import { createSession } from "./session";
import {
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  saveSession,
} from "./storage";

const availableSpeech = window.speechSynthesis;
const availableUtterance = window.SpeechSynthesisUtterance;
const availableWakeLock = Object.getOwnPropertyDescriptor(navigator, "wakeLock");

describe("Break Relay", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: availableSpeech,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: availableUtterance,
    });
    if (availableWakeLock) {
      Object.defineProperty(navigator, "wakeLock", availableWakeLock);
    } else {
      Reflect.deleteProperty(navigator, "wakeLock");
    }
  });

  it("covers setup, tailored launch, in-session controls, extension, and return", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Mark three places that can carry a break.",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Window or view/ }));
    await user.click(screen.getByRole("button", { name: /Water stop/ }));
    await user.click(screen.getByRole("button", { name: /Doorway/ }));

    expect(screen.getByText("3 / 3 minimum")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Shape my relay/ }));

    expect(
      screen.getByRole("heading", { name: "Shape this break around right now." }),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Tired eyes"));
    await user.click(screen.getByText("5", { selector: ".duration-picker strong" }));
    await user.click(screen.getByRole("button", { name: /Start this relay/ }));

    expect(
      screen.getByRole("heading", {
        name: "Set a boundary this browser can keep.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/locked-screen delivery still depends/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play cue check" }));
    vi.mocked(window.speechSynthesis.speak).mockClear();
    await user.click(screen.getByRole("button", { name: /Start and step away/ }));

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repeat cue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip stop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End early" })).toBeInTheDocument();
    expect(screen.getByText(/About 5 min remain/)).toBeInTheDocument();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Relay paused")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));

    for (let index = 0; index < 4; index += 1) {
      await user.click(screen.getByRole("button", { name: "Skip stop" }));
    }

    expect(
      screen.getByRole("heading", { name: "You’re back at the boundary." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add two quiet minutes/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Add two quiet minutes/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Two quiet minutes" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip stop" }));

    expect(
      screen.queryByRole("button", { name: /Add two quiet minutes/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ready to return/ }));

    expect(
      screen.getByRole("heading", {
        name: "What would feel different for a few minutes?",
      }),
    ).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.stations).toHaveLength(3);
    expect(stored.feeling).toBe("eyes");
    expect(stored.duration).toBe(5);
    expect(stored.hasOnboarded).toBe(true);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("lets a returning user edit stations and reset all local data", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 7,
        spaceMode: "any",
        audioEnabled: true,
        hasOnboarded: true,
      }),
    );
    render(<App />);

    await user.click(screen.getByRole("button", { name: "My relay" }));
    const settings = screen.getByRole("dialog", { name: "My relay settings" });
    expect(within(settings).getByText("Stored only on this device")).toBeVisible();

    await user.click(within(settings).getByRole("button", { name: /Edit/ }));
    await user.click(screen.getByRole("button", { name: /Plant or shelf/ }));
    await user.click(screen.getByRole("button", { name: /Save relay points/ }));

    expect(
      screen.getByRole("heading", {
        name: "What would feel different for a few minutes?",
      }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").stations).toHaveLength(
      4,
    );

    await user.click(screen.getByRole("button", { name: "My relay" }));
    await user.click(screen.getByRole("button", { name: /Reset local data/ }));
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));

    expect(
      screen.getByRole("heading", {
        name: "Mark three places that can carry a break.",
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("offers an interrupted relay for coherent resume or discard", async () => {
    const user = userEvent.setup();
    const preferences = {
      stations: STATION_PRESETS.slice(0, 3),
      feeling: "noise" as const,
      duration: 5 as const,
      spaceMode: "any" as const,
      audioEnabled: true,
      hasOnboarded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    const route = buildRoute(preferences.stations, "noise", 5, 10);
    saveSession(
      createSession({
        route,
        durationMinutes: 5,
        audioEnabled: true,
        keepAwake: false,
        now: Date.now() - 30_000,
        id: "interrupted",
      }),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Your break is still in progress." }),
    ).toBeInTheDocument();
    expect(screen.getByText(route[0].station.name)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Resume this relay" }),
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it("discards only the interrupted session and keeps saved stations", async () => {
    const user = userEvent.setup();
    const preferences = {
      stations: STATION_PRESETS.slice(0, 3),
      feeling: "eyes" as const,
      duration: 7 as const,
      spaceMode: "any" as const,
      audioEnabled: false,
      hasOnboarded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    saveSession(
      createSession({
        route: buildRoute(preferences.stations, "eyes", 7, 12),
        durationMinutes: 7,
        audioEnabled: false,
        keepAwake: false,
        now: Date.now() - 10_000,
        id: "discard-me",
      }),
    );

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Discard this relay" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "What would feel different for a few minutes?",
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").stations,
    ).toHaveLength(3);
  });

  it("treats an elapsed interrupted relay as complete without adding time", () => {
    const preferences = {
      stations: STATION_PRESETS.slice(0, 3),
      feeling: "noise" as const,
      duration: 5 as const,
      spaceMode: "any" as const,
      audioEnabled: true,
      hasOnboarded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    saveSession(
      createSession({
        route: buildRoute(preferences.stations, "noise", 5, 2),
        durationMinutes: 5,
        audioEnabled: true,
        keepAwake: false,
        now: Date.now() - 6 * 60_000,
        id: "stale",
      }),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "You’re back at the boundary." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/original 5-minute deadline passed/i)).toBeVisible();
    expect(screen.getByText(/no time was added/i)).toBeVisible();
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}").status,
    ).toBe("complete");
  });

  it("explains the no-speech and no-wake fallback without blocking launch", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "air",
        duration: 5,
        spaceMode: "any",
        audioEnabled: true,
        hasOnboarded: true,
      }),
    );
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: undefined,
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /Begin my break/ }));

    expect(screen.getByText("VISUAL CUES ONLY")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM FALLBACK")).toBeInTheDocument();
    expect(
      screen.getByText(/use your device’s timer as a backup/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Start and step away/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Keep this session awake" }),
    ).toBeDisabled();
  });

  it("requests wake only when opted in and releases it on pause and unmount", async () => {
    const user = userEvent.setup();
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockImplementation(async () => ({
      release,
      addEventListener: vi.fn(),
    }));
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "stiff",
        duration: 5,
        spaceMode: "any",
        audioEnabled: false,
        hasOnboarded: true,
      }),
    );

    const view = render(<App />);
    await user.click(screen.getByRole("button", { name: /Begin my break/ }));
    await user.click(
      screen.getByRole("checkbox", { name: "Keep this session awake" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Start and step away/ }),
    );

    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
    expect(document.querySelector(".session-page")).toHaveClass("is-dim-awake");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    view.unmount();
    await waitFor(() => expect(release).toHaveBeenCalledTimes(2));
  });
});

describe("route assembly", () => {
  it("uses real saved stations, tailors actions, and preserves the requested boundary", () => {
    const route = buildRoute(STATION_PRESETS.slice(0, 5), "eyes", 7, 42);
    const routeSeconds = route.reduce(
      (total, step) => total + step.durationSeconds,
      0,
    );

    expect(route).toHaveLength(5);
    expect(route.at(-1)?.kind).toBe("return");
    expect(route.at(-1)?.spokenCue).toContain("return cue");
    expect(routeSeconds).toBe(7 * 60);
    expect(route.slice(0, -1).every((step) => step.action.length > 20)).toBe(true);
    expect(
      route
        .slice(0, -1)
        .every((step) =>
          STATION_PRESETS.some((station) => station.id === step.station.id),
        ),
    ).toBe(true);
  });
});
