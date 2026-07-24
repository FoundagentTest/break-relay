import { DEFAULT_PREFERENCES } from "./data";
import type { Preferences } from "./types";

export const STORAGE_KEY = "break-relay-preferences-v1";

export function loadPreferences(): Preferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      stations: Array.isArray(parsed.stations) ? parsed.stations : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function clearPreferences() {
  window.localStorage.removeItem(STORAGE_KEY);
}
