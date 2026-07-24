import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { DEFAULT_PREFERENCES, STATION_PRESETS } from "./data";
import { ROUTE_MEMORY_STORAGE_KEY } from "./routeMemory";
import { stationForSpace } from "./spaces";
import {
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
} from "./storage";
import type { Preferences, RelaySpace } from "./types";

function savedStation(spaceId: string, presetId: string) {
  return stationForSpace(
    STATION_PRESETS.find((station) => station.id === presetId)!,
    spaceId,
    [],
  );
}

function returningPreferences(
  spaces: RelaySpace[],
  activeSpaceId = spaces[0].id,
): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    spaces,
    activeSpaceId,
    audioEnabled: false,
    hasOnboarded: true,
    launchSetupComplete: true,
  };
}

describe("relay space interactions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("switches configured spaces quickly and clears only temporary availability", async () => {
    const user = userEvent.setup();
    const home: RelaySpace = {
      id: "home",
      name: "Home desk",
      stations: [savedStation("home", "window")],
      spaceMode: "seated",
    };
    const office: RelaySpace = {
      id: "office",
      name: "Shared office",
      stations: [savedStation("office", "hallway")],
      spaceMode: "any",
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(returningPreferences([home, office], home.id)),
    );

    render(<App />);

    const switcher = screen.getByRole("combobox", {
      name: "Relay space",
    });
    expect(switcher).toHaveValue(home.id);
    expect(screen.getByText("Low movement · saved only in this browser")).toBeVisible();
    expect(
      within(
        screen.getByRole("list", { name: "Saved relay points" }),
      ).getByText("Window or view"),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Places available now/ }),
    );
    await user.click(screen.getByRole("checkbox", { name: /Window or view/ }));
    expect(screen.getByText("0 / 1")).toBeVisible();

    await user.selectOptions(switcher, office.id);

    expect(switcher).toHaveValue(office.id);
    expect(screen.getByText("A few rooms · saved only in this browser")).toBeVisible();
    expect(screen.getByText("1 / 1")).toBeVisible();
    expect(
      within(
        screen.getByRole("list", { name: "Saved relay points" }),
      ).getByText("Hallway"),
    ).toBeVisible();

    await user.selectOptions(switcher, home.id);

    expect(screen.getByText("1 / 1")).toBeVisible();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.spaces).toEqual([home, office]);
    expect(stored.activeSpaceId).toBe(home.id);
  });

  it("creates into focused setup, then renames, duplicates, and deletes with safeguards", async () => {
    const user = userEvent.setup();
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [savedStation("home", "window")],
      spaceMode: "seated",
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(returningPreferences([home])),
    );
    render(<App />);

    await user.click(screen.getByRole("button", { name: "My relay" }));
    expect(
      screen.getByText("Keep at least one space. You can empty or rename it instead."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Delete Home" }),
    ).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "Name a new relay space" }),
      "Shared office",
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(
      screen.getByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).toBeVisible();
    expect(screen.getByText("EDIT · Shared office")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Water stop/ }));
    await user.click(
      screen.getByRole("button", { name: "Save relay points" }),
    );

    expect(
      screen.getByRole("combobox", { name: "Relay space" }),
    ).toHaveDisplayValue("Shared office");
    expect(
      within(
        screen.getByRole("list", { name: "Saved relay points" }),
      ).getByText("Water stop"),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "My relay" }));
    await user.click(
      screen.getByRole("button", { name: "Rename Shared office" }),
    );
    const rename = screen.getByRole("textbox", {
      name: "Rename Shared office",
    });
    await user.clear(rename);
    await user.type(rename, "Temporary room");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByRole("button", { name: /Temporary room.*Active/ }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Duplicate Temporary room" }),
    );
    expect(
      screen.getByRole("button", { name: /Temporary room copy.*Active/ }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Delete Temporary room copy" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete space" }));
    expect(
      screen.queryByRole("button", { name: /Temporary room copy/ }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete Temporary room" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete space" }));

    expect(
      screen.getByRole("button", { name: "Delete Home" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Keep at least one space. You can empty or rename it instead."),
    ).toBeVisible();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.spaces).toHaveLength(1);
    expect(stored.spaces[0]).toEqual(home);
    expect(stored.activeSpaceId).toBe(home.id);
  });

  it("keeps an intentionally empty active space as a no-travel option", async () => {
    const user = userEvent.setup();
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [savedStation("home", "window")],
      spaceMode: "any",
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(returningPreferences([home])),
    );
    render(<App />);

    await user.click(screen.getByRole("button", { name: "My relay" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name a new relay space" }),
      "Empty room",
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("combobox", { name: "Relay space" }),
    ).toHaveDisplayValue("Empty room");
    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Begin a no-travel break" }),
    ).toBeEnabled();
  });

  it("fully resets every space, session record, and all-space history", async () => {
    const user = userEvent.setup();
    const home: RelaySpace = {
      id: "home",
      name: "Home",
      stations: [savedStation("home", "window")],
      spaceMode: "any",
    };
    const office: RelaySpace = {
      id: "office",
      name: "Office",
      stations: [savedStation("office", "water")],
      spaceMode: "small",
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(returningPreferences([home, office])),
    );
    render(<App />);
    localStorage.setItem(SESSION_STORAGE_KEY, "stale-session-record");
    localStorage.setItem(
      ROUTE_MEMORY_STORAGE_KEY,
      JSON.stringify({ version: 2, entries: [] }),
    );

    await user.click(screen.getByRole("button", { name: "My relay" }));
    await user.click(
      screen.getByRole("button", { name: "Reset local data" }),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ROUTE_MEMORY_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "Mark the places that can carry a break.",
      }),
    ).toBeVisible();
  });
});
