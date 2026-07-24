import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildRoute, STATION_PRESETS } from "./data";
import { STORAGE_KEY } from "./storage";

describe("Break Relay", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
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

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repeat cue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip stop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End early" })).toBeInTheDocument();
    expect(screen.getByText(/About 5 min remain/)).toBeInTheDocument();

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
