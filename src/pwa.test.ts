import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("offline and install metadata", () => {
  it("publishes an installable manifest with any and maskable icons", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"),
    );

    expect(manifest.name).toBe("Break Relay");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#153732");
    expect(
      manifest.icons.some(
        (icon: { sizes: string; purpose: string }) =>
          icon.sizes === "512x512" && icon.purpose === "maskable",
      ),
    ).toBe(true);
    for (const icon of manifest.icons) {
      expect(statSync(resolve(root, "public", icon.src.slice(1))).size).toBeGreaterThan(
        1000,
      );
    }
  });

  it("caches the current hashed shell and provides an explicit update path", () => {
    const worker = readFileSync(resolve(root, "public/sw.js"), "utf8");
    const registration = readFileSync(
      resolve(root, "src/ServiceWorkerUpdate.tsx"),
      "utf8",
    );
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).toContain('rel="manifest"');
    expect(worker).toContain("cacheCurrentShell");
    expect(worker).toContain("assetPaths");
    expect(worker).toContain("SKIP_WAITING");
    expect(registration).toContain('updateViaCache: "none"');
    expect(registration).toContain("refreshRequested.current");
    expect(registration).toContain("Update now");
  });
});
