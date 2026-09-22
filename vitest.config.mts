import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws unless bundled for React Server Components, but tests
      // import server modules directly.
      "server-only": fileURLToPath(
        new URL("./tests/helpers/empty-module.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "emulator",
          environment: "node",
          include: ["tests/emulator/**/*.test.ts"],
          setupFiles: ["./tests/setup/emulator.ts"],
        },
      },
    ],
  },
});
