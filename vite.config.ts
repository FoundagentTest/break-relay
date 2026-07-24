import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

function stampServiceWorker() {
  return {
    name: "stamp-service-worker",
    closeBundle() {
      const outputRoot = resolve(process.cwd(), "dist");
      const assetNames = readdirSync(resolve(outputRoot, "assets")).sort();
      const buildId = createHash("sha256")
        .update(assetNames.join("|"))
        .digest("hex")
        .slice(0, 12);
      const workerPath = resolve(outputRoot, "sw.js");
      const worker = readFileSync(workerPath, "utf8").replace(
        "__BREAK_RELAY_BUILD__",
        buildId,
      );
      writeFileSync(workerPath, worker);
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
