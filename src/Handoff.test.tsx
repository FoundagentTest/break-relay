import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildRoute, DEFAULT_PREFERENCES, STATION_PRESETS } from "./data";
import {
  HANDOFF_TTL_MS,
  MAX_HANDOFF_ENCODED_CHARS,
  createBreakHandoff,
  decodeBreakHandoff,
  encodeBreakHandoff,
  handoffUrl,
  type BreakHandoff,
} from "./handoff";
import { completeSession, createSession } from "./session";
import { stationForSpace } from "./spaces";
import {
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  saveSession,
} from "./storage";
import { ROUTE_MEMORY_STORAGE_KEY } from "./routeMemory";
import type { Preferences, RelaySpace } from "./types";

const availableSpeech = window.speechSynthesis;
const availableUtterance = window.SpeechSynthesisUtterance;
const availableWakeLock = Object.getOwnPropertyDescriptor(
  navigator,
  "wakeLock",
);

function relaySpace(): RelaySpace {
  const id = "space-near-window";
  return {
    id,
    name: "Window desk",
    spaceMode: "any",
    stations: ["window", "water", "doorway"].map((presetId) =>
      stationForSpace(
        STATION_PRESETS.find((station) => station.id === presetId)!,
        id,
        [],
      ),
    ),
  };
}

function configuredPreferences(space = relaySpace()): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    spaces: [space],
    activeSpaceId: space.id,
    feeling: "air",
    duration: 5,
    audioEnabled: false,
    launchSetupComplete: true,
    capabilitySnapshot: { speech: true, wakeLock: false },
    hasOnboarded: true,
  };
}

function preparedHandoff(now = Date.now()) {
  const space = relaySpace();
  const eligibleStations = space.stations.slice(1);
  return createBreakHandoff({
    space,
    feeling: "air",
    durationMinutes: 5,
    route: buildRoute(eligibleStations, "air", 5, 91, {
      spaceId: space.id,
      spaceMode: space.spaceMode,
    }),
    eligibleStations,
    unavailableStationIds: [space.stations[0].id],
    now,
  });
}

function openHandoff(handoff: BreakHandoff) {
  const url = new URL(handoffUrl(handoff, "http://localhost/"));
  window.history.replaceState({}, "", `/${url.hash}`);
}

describe("account-free device handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
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

  it("prepares the current adaptive break without starting the source, including temporary availability", async () => {
    const user = userEvent.setup();
    const preferences = configuredPreferences();
    const storedPreferences = JSON.stringify(preferences);
    localStorage.setItem(STORAGE_KEY, storedPreferences);

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /Places available now/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Window or view/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Use another device/ }),
    );

    expect(
      screen.getByRole("heading", { name: "Carry this break with you." }),
    ).toBeVisible();
    expect(
      screen.getByText(/did not start a timer or active relay here/i),
    ).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    ).toEqual(JSON.parse(storedPreferences));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();

    const link = (
      screen.getByLabelText("Private handoff link") as HTMLInputElement
    ).value;
    const decoded = decodeBreakHandoff(
      new URL(link).hash.replace("#relay=", ""),
    );
    expect(decoded.status).toBe("ready");
    if (decoded.status === "ready") {
      expect(decoded.handoff.space.name).toBe("Window desk");
      expect(decoded.handoff.feeling).toBe("air");
      expect(decoded.handoff.durationMinutes).toBe(5);
      expect(decoded.handoff.space.spaceMode).toBe("any");
      expect(decoded.handoff.unavailableStationIds).toEqual([
        "space-near-window:window",
      ]);
      expect(
        decoded.handoff.eligibleStations.map((station) => station.id),
      ).toEqual([
        "space-near-window:water",
        "space-near-window:doorway",
      ]);
    }
  });

  it("captures and scrubs a handoff pasted into an already-open clean receiver without reloading", async () => {
    const handoff = preparedHandoff();
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).toBeVisible();

    const url = new URL(handoffUrl(handoff, "http://localhost/"));
    window.location.hash = url.hash;

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "One prepared break. Start it here?",
        }),
      ).toBeVisible(),
    );
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/");
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).not.toBeInTheDocument();
  });

  it("lets a clean receiver confirm, applies real capability fallback, recovers full controls, and completes without onboarding first", async () => {
    const user = userEvent.setup();
    const handoff = preparedHandoff();
    openHandoff(handoff);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: undefined,
    });
    Reflect.deleteProperty(navigator, "wakeLock");

    render(<App />);

    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("heading", {
        name: "One prepared break. Start it here?",
      }),
    ).toBeVisible();
    expect(screen.getByText("Visible cues only")).toBeVisible();
    expect(screen.getByText("Normal screen sleep")).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Start on this device" }),
    );

    const active = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(active).toMatchObject({
      source: "handoff",
      audioEnabled: false,
      keepAwake: false,
      durationMinutes: 5,
      unavailableStationIds: ["space-near-window:window"],
    });
    expect(active.route).toEqual(handoff.route);
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Place unavailable" }),
    ).toBeVisible();
    expect(navigator.vibrate).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "End early" }));
    expect(
      screen.getByRole("button", {
        name: /Finish this handed-off break/,
      }),
    ).toBeVisible();
    expect(screen.getByText(/remains ephemeral/i)).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: /Finish this handed-off break/,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
  });

  it("preserves an already-configured receiver’s spaces, preferences, and learning through completion", async () => {
    const user = userEvent.setup();
    const receiverPreferences = configuredPreferences({
      id: "receiver-space",
      name: "My own office",
      spaceMode: "seated",
      stations: [
        stationForSpace(
          STATION_PRESETS.find(
            (station) => station.id === "turned-chair",
          )!,
          "receiver-space",
          [],
        ),
      ],
    });
    const preferenceSnapshot = JSON.stringify(receiverPreferences);
    const memorySnapshot = JSON.stringify({ version: 2, entries: [] });
    localStorage.setItem(STORAGE_KEY, preferenceSnapshot);
    localStorage.setItem(ROUTE_MEMORY_STORAGE_KEY, memorySnapshot);
    openHandoff(preparedHandoff());

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Start on this device" }),
    );
    await user.click(screen.getByRole("button", { name: "End early" }));
    await user.click(
      screen.getByRole("button", {
        name: /Finish this handed-off break/,
      }),
    );

    expect(
      screen.getByRole("combobox", { name: "Relay space" }),
    ).toHaveValue("receiver-space");
    expect(screen.getByText("My own office")).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(preferenceSnapshot);
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBe(
      memorySnapshot,
    );
  });

  it("does not overwrite or replay when another open tab has already created an active session", async () => {
    const user = userEvent.setup();
    openHandoff(preparedHandoff());
    render(<App />);
    expect(
      screen.getByRole("button", { name: "Start on this device" }),
    ).toBeVisible();

    const localSpace = relaySpace();
    const existing = createSession({
      id: "already-active",
      route: buildRoute(localSpace.stations, "noise", 5, 22),
      durationMinutes: 5,
      audioEnabled: false,
      keepAwake: false,
      spaceSnapshot: localSpace,
    });
    saveSession(existing);
    vi.clearAllMocks();

    await user.click(
      screen.getByRole("button", { name: "Start on this device" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Your break is still in progress.",
      }),
    ).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}").id,
    ).toBe("already-active");
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("recovers a paused handed-off session and keeps rerouting through the unavailable-place fallback", async () => {
    const user = userEvent.setup();
    openHandoff(preparedHandoff());
    const firstView = render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Start on this device" }),
    );
    await user.click(screen.getByRole("button", { name: "Pause" }));
    firstView.unmount();

    render(<App />);
    expect(
      screen.getByRole("heading", {
        name: "Your break is still in progress.",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Open paused relay" }),
    );
    await user.click(screen.getByRole("button", { name: "Resume" }));

    const original = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    const firstDestination = original.route[0].station.id;
    await user.click(
      screen.getByRole("button", { name: "Place unavailable" }),
    );
    const rerouted = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(rerouted).toMatchObject({
      source: "handoff",
      paused: false,
      rerouteCount: 1,
    });
    expect(rerouted.route[0].station.id).not.toBe(firstDestination);

    await user.click(
      screen.getByRole("button", { name: "Place unavailable" }),
    );
    expect(screen.getByText("Comfortable pause")).toBeVisible();
    const fallback = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(fallback).toMatchObject({
      source: "handoff",
      rerouteCount: 2,
    });
    expect(fallback.route[0]).toMatchObject({
      station: { id: "comfortable-pause" },
      phase: "quiet",
    });
  });

  it("extends a completed handed-off boundary using the same durable session without learning from it", async () => {
    const user = userEvent.setup();
    openHandoff(preparedHandoff());
    const firstView = render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Start on this device" }),
    );
    const active = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    saveSession(completeSession(active, false, active.deadlineAt));
    firstView.unmount();

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /Add two quiet minutes/ }),
    );

    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({
      source: "handoff",
      status: "active",
      extensionUsed: true,
      route: [{ phase: "extension", durationSeconds: 120 }],
    });
    expect(screen.getByText("Two quiet minutes")).toBeVisible();
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
  });

  it("fails invalid payloads into calm recovery without modifying preferences or starting", () => {
    const now = Date.now();
    const valid = preparedHandoff(now);
    const unsupported = encodeBreakHandoff({
      ...valid,
      version: 2,
    } as unknown as BreakHandoff);
    const expired = encodeBreakHandoff(
      preparedHandoff(now - HANDOFF_TTL_MS - 1),
    );
    const cases = [
      {
        encoded: "not_base64!",
        title: "This handoff could not be read.",
      },
      {
        encoded: "a".repeat(MAX_HANDOFF_ENCODED_CHARS + 1),
        title: "This handoff is too large to open safely.",
      },
      {
        encoded: unsupported,
        title: "This handoff needs a different Relay version.",
      },
      {
        encoded: expired,
        title: "This handoff has expired.",
      },
    ];

    for (const item of cases) {
      cleanup();
      localStorage.clear();
      const preferences = configuredPreferences();
      const snapshot = JSON.stringify(preferences);
      localStorage.setItem(STORAGE_KEY, snapshot);
      window.history.replaceState(
        {},
        "",
        `/#relay=${item.encoded}`,
      );

      const view = render(<App />);
      expect(
        screen.getByRole("heading", { name: item.title }),
      ).toBeVisible();
      expect(screen.getByText(/No break was started/i)).toBeVisible();
      expect(window.location.hash).toBe("");
      expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(snapshot);
      view.unmount();
    }
  });
});
