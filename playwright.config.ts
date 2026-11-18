import { defineConfig, devices } from "@playwright/test";

/** Real-browser end-to-end tests against the LOCAL dev server only — never a Vercel Preview/
 *  Production URL. See e2e/README.md for the mocking strategy (every Supabase-backed API route
 *  is intercepted at the browser network layer; nothing here ever writes to live Supabase, makes
 *  a real payment, or sends a real email). Chromium only — Firefox/WebKit binaries were never
 *  installed, to keep the install light; see e2e/README.md for how to add them if ever needed. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Reuses the dev server if one is already running on :3000 (common in this environment),
  // otherwise starts one itself. Never points at a Preview/Production URL.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "Desktop Chrome",
      // 1600x900, deliberately above Tailwind's 2xl (1536px) breakpoint -- Header.tsx's real
      // desktop nav (`hidden ... 2xl:block`) only renders at that width; the default Desktop
      // Chrome viewport (1280px) would actually see the mobile hamburger menu instead, which
      // isn't "desktop" in the way this app's own responsive design defines it.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
