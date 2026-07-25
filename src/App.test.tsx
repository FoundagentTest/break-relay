import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  CAPABILITY_CHECK_MAX_AGE_MS,
  capabilitySignature,
  formatLocalReturnTime,
} from "./readiness";
import { buildRoute, DEFAULT_PREFERENCES, STATION_PRESETS } from "./data";
import { completeSession, createSession, skipStep } from "./session";
import { ROUTE_MEMORY_STORAGE_KEY } from "./routeMemory";
import {
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  saveSession,
} from "./storage";

const availableSpeech = window.speechSynthesis;
const availableUtterance = window.SpeechSynthesisUtterance;
const availableAudio = window.Audio;
const availableWakeLock = Object.getOwnPropertyDescriptor(navigator, "wakeLock");

function verifiedSnapshot(wakeLock = false) {
  return {
    speech: true,
    wakeLock,
    checkedAt: Date.now(),
    signature: capabilitySignature(),
    chimeVerified: true,
    audibilityConfirmed: true,
    visualOnlyAcknowledged: false,
    speechVerified: true,
    wakeVerified: wakeLock,
  };
}

function storedActiveSpace() {
  const stored = JSON.parse(
    window.localStorage.getItem(STORAGE_KEY) ?? "{}",
  );
  return stored.spaces?.find(
    (space: { id: string }) => space.id === stored.activeSpaceId,
  );
}

async function confirmReadinessChime(
  user: ReturnType<typeof userEvent.setup>,
) {
  const launch = screen.getByRole("button", { name: /step away/i });
  if (!launch.hasAttribute("disabled")) return;
  await user.click(
    screen.getByRole("button", { name: /Play chime check/i }),
  );
  expect(
    await screen.findByText(/Playback started · audibility unknown/i),
  ).toBeVisible();
  expect(launch).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Yes, I heard it" }),
  );
  expect(launch).toBeEnabled();
}

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
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: availableAudio,
    });
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: availableAudio,
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
        name: "Mark the places that can carry a break.",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Window or view/ }));
    await user.click(screen.getByRole("button", { name: /Water stop/ }));
    await user.click(screen.getByRole("button", { name: /Doorway/ }));

    expect(screen.getByText("3 active now")).toBeInTheDocument();
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
      screen.getByText(/locked-screen playback may be silenced/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Test voice (optional)" }),
    ).toBeInTheDocument();
    await confirmReadinessChime(user);
    await user.click(screen.getByRole("button", { name: /step away/i }));

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repeat cue" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Place unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skip this cue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End early" })).toBeInTheDocument();
    expect(screen.getByText(/About 5 min remain/)).toBeInTheDocument();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Relay paused")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));

    await user.click(
      screen.getByRole("button", { name: "Skip this cue" }),
    );
    expect(screen.getByText("LAND HERE")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "End early" }));

    expect(
      screen.queryByRole("button", { name: /Add two quiet minutes/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /This route gave me a reset/ }),
    );

    expect(
      screen.getByRole("heading", {
        name: "What would feel different for a few minutes?",
      }),
    ).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(storedActiveSpace().stations).toHaveLength(3);
    expect(stored.feeling).toBe("eyes");
    expect(stored.duration).toBe(5);
    expect(stored.hasOnboarded).toBe(true);
    expect(stored.launchSetupComplete).toBe(true);
    expect(stored.keepAwake).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    const routeMemory = JSON.parse(
      localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY) ?? "{}",
    );
    expect(routeMemory.entries).toHaveLength(1);
    expect(routeMemory.entries[0]).toMatchObject({
      outcome: "useful",
      extensionUsed: false,
      endedEarly: true,
      feeling: "eyes",
      durationMinutes: 5,
      spaceMode: "any",
    });
  });

  it("keeps incompatible saved places when switching to low movement and launches safely", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Doorway/ }));
    await user.click(screen.getByRole("button", { name: /Hallway/ }));
    await user.click(
      screen.getByRole("button", { name: /Outside step/ }),
    );
    expect(screen.getByText("3 active now")).toBeVisible();

    await user.click(screen.getByText("Low movement", { exact: true }));

    expect(screen.getByText("0 active now")).toBeVisible();
    expect(
      screen.getByText(/3 saved places are inactive in this mode, but still stored/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Shape my relay/ }),
    ).toBeDisabled();
    const selectedRoute = screen.getByRole("complementary", {
      name: "Your selected route",
    });
    expect(
      within(selectedRoute).getByText(/Doorway, Hallway, Outside step/),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Window or view/ }),
    );
    await user.click(screen.getByRole("button", { name: /Water stop/ }));
    await user.click(
      screen.getByRole("button", { name: /Chair turned away/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Shape my relay/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Start this relay/ }),
    );
    await confirmReadinessChime(user);
    await user.click(
      screen.getByRole("button", { name: /step away/i }),
    );

    expect(screen.getByText("NEXT PLACE")).toBeVisible();
    const active = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(active.status).toBe("active");
    expect(active.route[0].action).toContain("staying seated if you prefer");
    expect(
      active.route
        .filter(
          (phase: { phase: string }) =>
            phase.phase === "move" || phase.phase === "arrive",
        )
        .every(
          (phase: { station: { modes: string[] } }) =>
            phase.station.modes.includes("seated"),
        ),
    ).toBe(true);
    expect(
      storedActiveSpace().stations,
    ).toHaveLength(6);
  });

  it("keeps legacy places and offers a no-travel launch when none match the mode", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: [
          STATION_PRESETS.find((station) => station.id === "doorway"),
          STATION_PRESETS.find((station) => station.id === "hallway"),
          STATION_PRESETS.find((station) => station.id === "outside"),
        ],
        feeling: "noise",
        duration: 7,
        spaceMode: "seated",
        audioEnabled: false,
        launchSetupComplete: true,
        hasOnboarded: true,
      }),
    );

    render(<App />);

    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Begin a no-travel break" }),
    ).toBeEnabled();
    expect(
      storedActiveSpace().stations,
    ).toHaveLength(3);
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
    expect(within(settings).getByText("Route learning stays here")).toBeVisible();

    await user.click(within(settings).getByRole("button", { name: /Edit/ }));
    await user.click(screen.getByRole("button", { name: /Plant or shelf/ }));
    await user.click(screen.getByRole("button", { name: /Save relay points/ }));

    expect(
      screen.getByRole("heading", {
        name: "What would feel different for a few minutes?",
      }),
    ).toBeInTheDocument();
    expect(storedActiveSpace().stations).toHaveLength(
      4,
    );

    await user.click(screen.getByRole("button", { name: "My relay" }));
    localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [] }),
    );
    await user.click(screen.getByRole("button", { name: /Reset local data/ }));
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));

    expect(
      screen.getByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
  });

  it("erases route history independently while keeping saved stations", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 7,
        spaceMode: "any",
        audioEnabled: false,
        hasOnboarded: true,
      }),
    );
    localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [] }),
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: "My relay" }));
    await user.click(
      screen.getByRole("button", { name: "Erase route history" }),
    );
    await user.click(screen.getByRole("button", { name: "Erase history" }));

    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
    expect(storedActiveSpace().stations).toHaveLength(
      3,
    );
    expect(
      screen.getByText("Route history for all spaces erased. Stations are unchanged."),
    ).toBeVisible();
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

  it("labels and speaks a same-place follow-up as staying, not moving again", async () => {
    const user = userEvent.setup();
    const stations = [
      STATION_PRESETS.find((station) => station.id === "window")!,
      STATION_PRESETS.find((station) => station.id === "plant")!,
      STATION_PRESETS.find(
        (station) => station.id === "quiet-corner",
      )!,
    ];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations,
        feeling: "eyes",
        duration: 7,
        spaceMode: "any",
        audioEnabled: true,
        hasOnboarded: true,
      }),
    );
    const route = buildRoute(stations, "eyes", 7, 27);
    const quietIndex = route.findIndex((step) => step.phase === "quiet");
    const elapsedBeforeQuiet = route
      .slice(0, quietIndex)
      .reduce(
        (total, step) => total + step.durationSeconds * 1_000,
        0,
      );
    saveSession(
      createSession({
        route,
        durationMinutes: 7,
        audioEnabled: true,
        keepAwake: false,
        now: Date.now() - elapsedBeforeQuiet - 1_000,
        id: "same-place-follow-up",
      }),
    );

    render(<App />);

    expect(screen.getByText("QUIET CARRY")).toBeVisible();
    expect(
      screen.getByText(`Phase ${quietIndex + 1} of ${route.length}`),
    ).toBeVisible();
    expect(
      screen.getByText(route[quietIndex].station.name),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Resume this relay" }),
    );
    expect(screen.getByText("QUIET CARRY")).toBeVisible();
    expect(screen.getByText(/PHASE \d+ OF \d+/)).toBeVisible();
    const utterance = vi.mocked(window.speechSynthesis.speak).mock
      .calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toMatch(/^Quiet carry at /);
    expect(utterance.text).not.toContain("Move phase");
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
      storedActiveSpace().stations,
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
      screen.getByRole("heading", { name: "Your return boundary is here." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/original 5-minute deadline passed/i)).toBeVisible();
    expect(screen.getByText(/no time was added/i)).toBeVisible();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}").status,
    ).toBe("complete");
  });

  it("records that a particular completed route did not fit", async () => {
    const user = userEvent.setup();
    const preferences = {
      stations: STATION_PRESETS.slice(0, 3),
      feeling: "air" as const,
      duration: 5 as const,
      spaceMode: "any" as const,
      audioEnabled: false,
      hasOnboarded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    const route = buildRoute(preferences.stations, "air", 5, 91);
    const started = createSession({
      route,
      durationMinutes: 5,
      audioEnabled: false,
      keepAwake: false,
      now: 1_000,
      id: "not-fit-route",
      routeContext: {
        feeling: "air",
        spaceMode: "any",
        steps: route
          .filter(
            (step) =>
              step.phase === "arrive" ||
              (step.phase === "quiet" &&
                step.station.id !== "comfortable-pause"),
          )
          .map((step) => ({
            stepId: step.id,
            stationId: step.station.id,
            stationName: step.station.name,
            action: step.action,
          })),
      },
    });
    saveSession(completeSession(started, false, 10_000));

    render(<App />);
    expect(
      screen.getByRole("button", { name: /This route gave me a reset/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /This route didn’t fit/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Leave without rating" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /This route didn’t fit/ }),
    );

    const memory = JSON.parse(
      localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY) ?? "{}",
    );
    expect(memory.entries[0]).toMatchObject({
      id: "not-fit-route",
      outcome: "not_fit",
      endedEarly: false,
    });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("keeps an early end and skipped station neutral when leaving unrated", async () => {
    const user = userEvent.setup();
    const preferences = {
      stations: STATION_PRESETS.slice(0, 3),
      feeling: "stiff" as const,
      duration: 7 as const,
      spaceMode: "any" as const,
      audioEnabled: false,
      hasOnboarded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    const route = buildRoute(preferences.stations, "stiff", 7, 31);
    const started = createSession({
      route,
      durationMinutes: 7,
      audioEnabled: false,
      keepAwake: false,
      now: 1_000,
      id: "neutral-early-route",
      routeContext: {
        feeling: "stiff",
        spaceMode: "any",
        steps: route
          .filter(
            (step) =>
              step.phase === "arrive" ||
              (step.phase === "quiet" &&
                step.station.id !== "comfortable-pause"),
          )
          .map((step) => ({
            stepId: step.id,
            stationId: step.station.id,
            stationName: step.station.name,
            action: step.action,
          })),
      },
    });
    const moved = skipStep(started, 2_000);
    const skipped = skipStep(moved, 3_000);
    const reachedNextRealAction = skipStep(skipped, 4_000);
    saveSession(completeSession(reachedNextRealAction, true, 4_000));

    render(<App />);
    expect(screen.getByText(/Stopping early is a complete choice, not a rating/i)).toBeVisible();
    expect(screen.getByText(/Skipped or unreached action phases stay neutral/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Add two quiet minutes/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Leave without rating" }),
    );

    const memory = JSON.parse(
      localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY) ?? "{}",
    );
    expect(memory.entries[0]).toMatchObject({
      outcome: "unrated",
      endedEarly: true,
    });
    expect(memory.entries[0].steps[0].skipped).toBe(true);
    expect(memory.entries[0].steps[0].used).toBe(false);
    expect(memory.entries[0].steps[1].used).toBe(true);
    expect(memory.entries[0].steps[2].used).toBe(false);
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
      screen.getByText(/set a 5-minute device timer/i),
    ).toBeVisible();
    await confirmReadinessChime(user);
    expect(
      screen.getByRole("button", { name: /step away/i }),
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
    await user.click(
      screen.getByRole("button", { name: "Review or change" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Keep this session awake" }),
    );
    await confirmReadinessChime(user);
    await user.click(
      screen.getByRole("button", { name: /step away/i }),
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

  it("starts a returning relay from one primary action with remembered modes", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "eyes",
        duration: 7,
        spaceMode: "any",
        audioEnabled: true,
        keepAwake: true,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(true),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    expect(
      screen.getByText("Chime heard recently + visible cues"),
    ).toBeVisible();
    expect(screen.getByText("Voice started in a recent check")).toBeVisible();
    expect(screen.getByText("Keep dim display awake")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Begin .*break/ }),
    );

    expect(
      screen.queryByRole("heading", {
        name: "Set a boundary this browser can keep.",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({
      audioEnabled: true,
      keepAwake: true,
      lastAnnouncedStepId: expect.any(String),
    });
  });

  it("previews the exact purposeful route that the primary action starts", async () => {
    const user = userEvent.setup();
    const stations = ["window", "water", "hallway"].map(
      (id) => STATION_PRESETS.find((station) => station.id === id)!,
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_PREFERENCES,
        spaces: [
          {
            id: "preview-space",
            name: "Home",
            stations,
            spaceMode: "any",
          },
        ],
        activeSpaceId: "preview-space",
        feeling: "noise",
        duration: 7,
        audioEnabled: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);

    const preview = screen.getByRole("list", {
      name: "Prepared relay route",
    });
    const previewItems = within(preview).getAllByRole("listitem");
    const previewSteps = previewItems
      .map((item) => ({
        id: item.dataset.routeStepId,
        phase: item.dataset.phase,
        durationSeconds: Number(item.dataset.durationSeconds),
      }));

    expect(previewSteps.map((step) => step.phase)).toEqual([
      "move",
      "arrive",
      "move",
      "arrive",
      "quiet",
      "return",
    ]);
    expect(
      previewSteps.reduce(
        (seconds, step) => seconds + step.durationSeconds,
        0,
      ),
    ).toBe(7 * 60);
    expect(within(preview).getAllByText("NEXT PLACE")).toHaveLength(2);
    expect(within(preview).getAllByText("LAND HERE")).toHaveLength(2);
    expect(
      previewItems.every(
        (item) =>
          Boolean(item.querySelector("strong")?.textContent) &&
          /\d+ (?:sec|min)/.test(item.querySelector("em")?.textContent ?? ""),
      ),
    ).toBe(true);
    expect(preview).toHaveTextContent(/Go to (Water stop|Hallway)/);
    expect(preview).toHaveTextContent(/At (Water stop|Hallway)/);
    expect(within(preview).getByText("Quiet at Window or view")).toBeVisible();
    expect(within(preview).getByText("RETURN WINDOW")).toBeVisible();
    expect(within(preview).getByText("Return window")).toBeVisible();
    expect(within(preview).queryByText(/Comfortable pause/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    const active = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(
      active.route.map(
        (step: {
          id: string;
          phase: string;
          durationSeconds: number;
        }) => ({
          id: step.id,
          phase: step.phase,
          durationSeconds: step.durationSeconds,
        }),
      ),
    ).toEqual(previewSteps);
  });

  it("lets a remembered visual-mode user review, test, and restore spoken cues", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 5,
        spaceMode: "any",
        audioEnabled: false,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    expect(
      screen.getByText("Chime heard recently + visible cues"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Review or change" }),
    );

    expect(
      screen.getByRole("button", { name: "Use spoken cues" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Test voice (optional)" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use spoken cues" }));
    await user.click(
      screen.getByRole("button", { name: "Test voice (optional)" }),
    );
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    await confirmReadinessChime(user);
    await user.click(screen.getByRole("button", { name: /step away/i }));

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ audioEnabled: true });
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ audioEnabled: true, status: "active" });
  });

  it("blocks departure when wake is denied, then allows an explicit no-wake launch", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "eyes",
        duration: 5,
        spaceMode: "any",
        audioEnabled: false,
        keepAwake: true,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(true),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Screen wake was not granted/i),
      ).toBeVisible(),
    );
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").launchNeedsReview,
    ).toBe(true);
    await user.click(
      screen.getByRole("checkbox", { name: "Keep this session awake" }),
    );
    await confirmReadinessChime(user);
    await user.click(
      screen.getByRole("button", { name: /step away/i }),
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({
      status: "active",
      wakeLockFailed: false,
      keepAwake: false,
    });
  });

  it("requires a heard-by-user chime check before first-use sound launch", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Window or view/ }));
    await user.click(screen.getByRole("button", { name: /Water stop/ }));
    await user.click(screen.getByRole("button", { name: /Doorway/ }));
    await user.click(screen.getByRole("button", { name: /Shape my relay/ }));
    await user.click(screen.getByRole("button", { name: /Start this relay/ }));

    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /step away/i }),
    ).toBeDisabled();
    await confirmReadinessChime(user);
    await user.click(screen.getByRole("button", { name: /step away/i }));

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = vi.mocked(window.speechSynthesis.speak).mock
      .calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).not.toContain("Break Relay is ready");
    expect(utterance.text).toContain(
      screen.getByRole("heading", { level: 1 }).textContent,
    );
  });

  it("never treats playback start alone as audible when the user did not hear it", async () => {
    const user = userEvent.setup();
    const transportOnlySnapshot = {
      ...verifiedSnapshot(),
      audibilityConfirmed: undefined,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 5,
        spaceMode: "any",
        audioEnabled: true,
        cueSoundEnabled: true,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: transportOnlySnapshot,
        hasOnboarded: true,
      }),
    );

    render(<App />);
    expect(
      screen.getByText("Chime needs a heard-by-you check"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    const launch = screen.getByRole("button", { name: /step away/i });
    expect(launch).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Play chime check" }),
    );

    expect(
      await screen.findByText("PLAYBACK STARTED · AUDIBILITY UNKNOWN"),
    ).toBeVisible();
    expect(launch).toBeDisabled();
    expect(screen.queryByText(/chime heard/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "I didn’t hear it" }),
    );
    expect(screen.getByText("CHIME NOT AVAILABLE")).toBeVisible();
    expect(screen.getByText("Sound is not dependable here.")).toBeVisible();
    expect(screen.getByText("Local return time")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy exact return time" }),
    ).toBeEnabled();
    expect(launch).toBeDisabled();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
        .capabilitySnapshot.audibilityConfirmed,
    ).not.toBe(true);
  });

  it("shows one expired cue, voice, and wake state across Home, Settings, and readiness", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_PREFERENCES,
        stations: STATION_PRESETS.slice(0, 3),
        audioEnabled: true,
        keepAwake: true,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: {
          ...verifiedSnapshot(true),
          checkedAt: Date.now() - CAPABILITY_CHECK_MAX_AGE_MS - 1,
        },
        hasOnboarded: true,
      }),
    );

    render(<App />);

    expect(screen.getByText("Chime hearing check expired")).toBeVisible();
    expect(screen.getByText("Voice check expired")).toBeVisible();
    expect(screen.getByText("Screen wake check expired")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "My relay" }));
    const settings = screen.getByRole("dialog", {
      name: "My relay settings",
    });
    expect(
      within(settings).getByText(
        "Chosen, but a new heard-by-you chime check is required.",
      ),
    ).toBeVisible();
    expect(
      within(settings).getByText(
        "The saved voice check expired; API presence is not playback proof.",
      ),
    ).toBeVisible();
    expect(
      within(settings).getByText(
        "The saved screen-wake check expired; a chosen launch must obtain it again.",
      ),
    ).toBeVisible();

    await user.click(
      within(settings).getByRole("button", { name: "Review setup" }),
    );
    expect(screen.getByText("CHIME READY TO CHECK")).toBeVisible();
    expect(screen.getByText("VOICE CHECK EXPIRED")).toBeVisible();
    expect(screen.getByText("SCREEN WAKE CHECK EXPIRED")).toBeVisible();
    expect(
      screen.queryByText(/VOICE PLAYBACK VERIFIED/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /step away/i }),
    ).toBeDisabled();
  });

  it("routes capability changes to review before creating a session", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "air",
        duration: 5,
        spaceMode: "any",
        audioEnabled: true,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
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
    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    expect(screen.getByText("VOICE CHECK EXPIRED")).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    await confirmReadinessChime(user);
    await user.click(screen.getByRole("button", { name: /step away/i }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ audioEnabled: false });
  });

  it("keeps one active route and exposes fallback when the first cue fails", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    vi.mocked(window.speechSynthesis.speak).mockImplementationOnce(
      (utterance) => {
        utterance.onerror?.({
          error: "synthesis-failed",
        } as SpeechSynthesisErrorEvent);
      },
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 5,
        spaceMode: "any",
        audioEnabled: true,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    expect(screen.getByText("Local return time")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy exact return time" }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Copy exact return time" }),
    );
    expect(await screen.findByText("Exact return time copied.")).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Break Relay return time: .+\. If you need a locked-screen alert, set a 5-minute device timer now\./,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    expect(screen.getByText(/Voice did not start/i)).toBeVisible();
    expect(
      screen.getByText(/independent chime and visible cue remain active/i),
    ).toBeVisible();
    expect(screen.getByText("Local return time")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy exact return time" }),
    ).toBeEnabled();
    const failedSession = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(failedSession).toMatchObject({
      status: "active",
      currentStepIndex: 0,
      cueDeliveryFailed: false,
      speechDeliveryFailed: true,
      audioEnabled: false,
      lastAnnouncedStepId: failedSession.route[0].id,
    });
    expect(
      screen.getByText(formatLocalReturnTime(failedSession.deadlineAt)),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Copy exact return time" }),
    );
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `Break Relay return time: ${formatLocalReturnTime(
          failedSession.deadlineAt,
        )}.`,
      ),
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").audioEnabled,
    ).toBe(false);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Repeat cue" }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it("keeps one exact-time action visible for persisted active chime and wake failures", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const route = buildRoute(STATION_PRESETS.slice(0, 3), "noise", 5, 84);
    const failedSession = {
      ...createSession({
        route,
        durationMinutes: 5,
        cueSoundEnabled: true,
        audioEnabled: false,
        keepAwake: true,
      }),
      cueDeliveryFailed: true,
      wakeLockFailed: true,
    };
    saveSession(failedSession);

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /Resume this relay/i }),
    );

    expect(
      screen.getByText(/The chime failed during this relay/i),
    ).toBeVisible();
    expect(
      screen.getByText(/Screen wake could not be maintained/i),
    ).toBeVisible();
    expect(
      screen.getByText(formatLocalReturnTime(failedSession.deadlineAt)),
    ).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Copy exact return time" }),
    ).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Copy exact return time" }),
    );
    expect(await screen.findByText("Exact return time copied.")).toBeVisible();
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `Break Relay return time: ${formatLocalReturnTime(
          failedSession.deadlineAt,
        )}.`,
      ),
    );
  });

  it("stops before departure when chime playback rejects and offers an exact visual-only fallback", async () => {
    const user = userEvent.setup();
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_PREFERENCES,
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "noise",
        duration: 5,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /Begin .*break/ }),
    );

    expect(
      await screen.findByText("Sound is not dependable here."),
    ).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.getByText("Local return time")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy exact return time" }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("checkbox", { name: "Use offline sound cues" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Start visual-only relay" }),
    );

    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({
      cueSoundEnabled: false,
      cueDeliveryFailed: false,
      status: "active",
    });
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it("honors explicit review-every-time without starting early", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: STATION_PRESETS.slice(0, 3),
        feeling: "stiff",
        duration: 10,
        spaceMode: "any",
        audioEnabled: false,
        keepAwake: false,
        alwaysReviewLaunch: true,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    expect(
      screen.getByText(/Launch review is required before every relay/i),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Begin my break" }));
    expect(
      screen.getByRole("heading", {
        name: "Set a boundary this browser can keep.",
      }),
    ).toBeVisible();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("migrates existing preferences in place without resetting stations or history", async () => {
    const user = userEvent.setup();
    const stations = STATION_PRESETS.slice(0, 3);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations,
        feeling: "eyes",
        duration: 7,
        spaceMode: "small",
        audioEnabled: true,
        hasOnboarded: true,
      }),
    );
    const history = { version: 1, entries: [] };
    localStorage.setItem(ROUTE_MEMORY_STORAGE_KEY, JSON.stringify(history));

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Begin my break" }));

    expect(
      screen.getByRole("heading", {
        name: "Set a boundary this browser can keep.",
      }),
    ).toBeVisible();
    await confirmReadinessChime(user);
    await user.click(
      screen.getByRole("button", { name: /step away/i }),
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    const migrated = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(migrated.spaces).toEqual([
      expect.objectContaining({
        id: "space-default",
        name: "My space",
        stations,
        spaceMode: "small",
      }),
    ]);
    expect(migrated.activeSpaceId).toBe("space-default");
    expect(migrated).toMatchObject({
      launchSetupComplete: true,
      keepAwake: false,
      alwaysReviewLaunch: false,
      launchNeedsReview: false,
    });
    expect(JSON.parse(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY) ?? "{}"))
      .toEqual({ version: 2, entries: [] });
  });

  it("applies quick availability to one break and restores the saved defaults afterward", async () => {
    const user = userEvent.setup();
    const stations = [
      STATION_PRESETS.find((station) => station.id === "window"),
      STATION_PRESETS.find((station) => station.id === "plant"),
      STATION_PRESETS.find((station) => station.id === "quiet-corner"),
    ];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations,
        feeling: "eyes",
        duration: 5,
        spaceMode: "any",
        audioEnabled: false,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /Places available now/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Window or view/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Quiet corner/ }),
    );
    expect(screen.getByText("1 / 3")).toBeVisible();
    expect(
      storedActiveSpace().stations,
    ).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Begin my break" }));
    const active = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(active.eligibleStations).toHaveLength(1);
    expect(active.route[0].station.id).toBe("plant");

    await user.click(screen.getByRole("button", { name: "End early" }));
    await user.click(
      screen.getByRole("button", { name: "Leave without rating" }),
    );
    expect(
      screen.getByRole("button", { name: /Places available now 3 \/ 3/ }),
    ).toBeVisible();
  });

  it("reroutes each rejected destination once, announces only the replacement, and ends in a bounded pause", async () => {
    const user = userEvent.setup();
    const stations = [
      STATION_PRESETS.find((station) => station.id === "window"),
      STATION_PRESETS.find((station) => station.id === "plant"),
      STATION_PRESETS.find((station) => station.id === "quiet-corner"),
    ];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations,
        feeling: "noise",
        duration: 7,
        spaceMode: "any",
        audioEnabled: true,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Begin my break" }));
    const original = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    for (let revision = 1; revision <= 3; revision += 1) {
      await user.click(
        screen.getByRole("button", { name: "Place unavailable" }),
      );
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(
        revision + 1,
      );
    }

    expect(
      screen.getByRole("heading", { name: "No-travel pause" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Place unavailable" }),
    ).not.toBeInTheDocument();
    const rerouted = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(rerouted).toMatchObject({
      id: original.id,
      deadlineAt: original.deadlineAt,
      rerouteCount: 3,
    });
    expect(new Set(rerouted.unavailableStationIds).size).toBe(3);

    await user.click(screen.getByRole("button", { name: "End early" }));
    const finished = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(finished.eligibleStations).toEqual([]);
    expect(finished.unavailableStationIds).toEqual([]);
  });

  it("lets a paused relay reject an upcoming real place inside the same deadline", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stations: ["window", "water", "hallway"].map((id) =>
          STATION_PRESETS.find((station) => station.id === id),
        ),
        feeling: "noise",
        duration: 10,
        spaceMode: "any",
        audioEnabled: false,
        keepAwake: false,
        alwaysReviewLaunch: false,
        launchSetupComplete: true,
        launchNeedsReview: false,
        capabilitySnapshot: verifiedSnapshot(),
        hasOnboarded: true,
      }),
    );

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Begin my break" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    const original = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );

    await user.click(
      screen.getByText("One of the next places is unavailable"),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Window or view is unavailable",
      }),
    );

    const rerouted = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "{}",
    );
    expect(rerouted).toMatchObject({
      id: original.id,
      paused: true,
      pausedAt: original.pausedAt,
      deadlineAt: original.deadlineAt,
      rerouteCount: 1,
    });
    expect(
      rerouted.route.some(
        (step: { station: { id: string } }) =>
          step.station.id === "window",
      ),
    ).toBe(false);
    expect(rerouted.unavailableStationIds).toContain("window");
    expect(screen.getByText("Relay paused")).toBeVisible();
  });
});

describe("route assembly", () => {
  it("uses real saved stations, tailors actions, and preserves the requested boundary", () => {
    const route = buildRoute(STATION_PRESETS.slice(0, 5), "eyes", 7, 42);
    const routeSeconds = route.reduce(
      (total, step) => total + step.durationSeconds,
      0,
    );

    expect(route.map((step) => step.phase)).toEqual([
      "move",
      "arrive",
      "move",
      "arrive",
      "quiet",
      "return",
    ]);
    expect(route.at(-1)?.phase).toBe("return");
    expect(route.at(-1)?.spokenCue).toContain("Return phase");
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
