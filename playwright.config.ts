import { defineConfig, devices } from "@playwright/test";

const port = 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  // Students use whatever the school hands them, so both engines are covered.
  // CI runs Firefox on Linux; its current Windows binary has a broken mozglue
  // side-by-side manifest, while Chromium still verifies the Windows app path.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PLAYWRIGHT_SKIP_FIREFOX === "1"
      ? []
      : [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }]),
  ],
  webServer: {
    // CI tests the production build, as Next.js recommends; locally the dev server
    // saves a rebuild on every run.
    command: process.env.CI
      ? `pnpm start --port ${port}`
      : `pnpm exec next dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // Browser tests use the fake analyser even when .env.local has an OpenAI key.
    // An already running dev server is reused as it is, so stop it first.
    env: { CLARIFAI_FAKE_ANALYSIS: "1" },
  },
});
