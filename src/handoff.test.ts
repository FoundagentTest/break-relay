import { describe, expect, it } from "vitest";
import { buildRoute, STATION_PRESETS } from "./data";
import {
  HANDOFF_FRAGMENT_KEY,
  HANDOFF_TTL_MS,
  MAX_HANDOFF_ENCODED_CHARS,
  captureHandoffFromLocation,
  createBreakHandoff,
  decodeBreakHandoff,
  encodeBreakHandoff,
  handoffUrl,
  regenerateBreakHandoff,
  type BreakHandoff,
} from "./handoff";
import type { RelaySpace } from "./types";

function preparedBreak(now = 1_000_000) {
  const space: RelaySpace = {
    id: "space-studio",
    name: "Studio",
    spaceMode: "any",
    stations: STATION_PRESETS.slice(0, 3).map((station) => ({
      ...station,
      id: `space-studio:${station.id}`,
      presetId: station.id,
    })),
  };
  const eligibleStations = space.stations.slice(1);
  const route = buildRoute(eligibleStations, "eyes", 7, 42, {
    spaceId: space.id,
    spaceMode: space.spaceMode,
  });
  return createBreakHandoff({
    space,
    feeling: "eyes",
    durationMinutes: 7,
    route,
    eligibleStations,
    unavailableStationIds: [space.stations[0].id],
    now,
  });
}

describe("private break handoff payload", () => {
  it("round-trips the exact adaptive route, namespaced station IDs, and temporary exclusions", () => {
    const handoff = preparedBreak();
    const encoded = encodeBreakHandoff(handoff);
    const decoded = decodeBreakHandoff(encoded, handoff.createdAt + 1);

    expect(encoded.length).toBeLessThanOrEqual(MAX_HANDOFF_ENCODED_CHARS);
    expect(decoded).toEqual({ status: "ready", handoff });
    expect(
      decoded.status === "ready"
        ? decoded.handoff.space.stations.map((station) => station.id)
        : [],
    ).toEqual([
      "space-studio:window",
      "space-studio:water",
      "space-studio:doorway",
    ]);
    expect(
      decoded.status === "ready"
        ? decoded.handoff.unavailableStationIds
        : [],
    ).toEqual(["space-studio:window"]);
    expect(
      decoded.status === "ready"
        ? decoded.handoff.route.reduce(
            (seconds, step) => seconds + step.durationSeconds,
            0,
          )
        : 0,
    ).toBe(7 * 60);
  });

  it("keeps private data in the fragment and scrubs it before returning the captured payload", () => {
    const handoff = preparedBreak();
    const url = handoffUrl(handoff, "https://break-relay.test/");
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/");
    expect(parsed.search).toBe("");
    expect(parsed.hash).toMatch(
      new RegExp(`^#${HANDOFF_FRAGMENT_KEY}=[A-Za-z0-9_-]+$`),
    );
    expect(url.split("#")[0]).not.toContain("Studio");

    window.history.replaceState({}, "", `/${parsed.hash}`);
    const captured = captureHandoffFromLocation(
      window,
      handoff.createdAt + 1,
    );

    expect(captured).toEqual({ status: "ready", handoff });
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/");
  });

  it("regenerates the link lifetime and identity without changing the prepared route", () => {
    const first = preparedBreak();
    const next = regenerateBreakHandoff(first, first.createdAt + 4_000);

    expect(next.id).not.toBe(first.id);
    expect(next.createdAt).toBe(first.createdAt + 4_000);
    expect(next.expiresAt).toBe(next.createdAt + HANDOFF_TTL_MS);
    expect(next.route).toEqual(first.route);
    expect(next.space).toEqual(first.space);
    expect(next.eligibleStations).toEqual(first.eligibleStations);
    expect(next.unavailableStationIds).toEqual(
      first.unavailableStationIds,
    );
  });

  it("rejects expiry, corruption, oversize, unsupported versions, and route-boundary tampering", () => {
    const handoff = preparedBreak();
    const unsupported = {
      ...handoff,
      version: 2,
    } as unknown as BreakHandoff;
    const tampered = structuredClone(handoff);
    tampered.route[0].durationSeconds += 1;

    expect(
      decodeBreakHandoff(
        encodeBreakHandoff(handoff),
        handoff.expiresAt,
      ),
    ).toEqual({ status: "error", reason: "expired" });
    expect(decodeBreakHandoff("not_base64!")).toEqual({
      status: "error",
      reason: "corrupt",
    });
    expect(
      decodeBreakHandoff("a".repeat(MAX_HANDOFF_ENCODED_CHARS + 1)),
    ).toEqual({ status: "error", reason: "oversized" });
    expect(
      decodeBreakHandoff(
        encodeBreakHandoff(unsupported),
        handoff.createdAt + 1,
      ),
    ).toEqual({ status: "error", reason: "unsupported" });
    expect(
      decodeBreakHandoff(
        encodeBreakHandoff(tampered),
        handoff.createdAt + 1,
      ),
    ).toEqual({ status: "error", reason: "corrupt" });
  });
});
