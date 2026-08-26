import { defineConfig, devices } from "@playwright/test";

const webServerCommand = process.env.CI
  ? "pnpm --filter web start"
  : "pnpm --filter web dev";

export default defineConfig({
  testDir: "./tests/autoqa",
  globalSetup: "./tests/autoqa/global.setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  outputDir: "test-results",
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/autoqa-results.json" }],
    ["junit", { outputFile: "test-results/autoqa-junit.xml" }],
  ],
  use: {
    baseURL: process.env.AUTOQA_BASE_URL ?? "http://127.0.0.1:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    // No CI, o Technical Quality Gate já gerou o build; o AutoQA valida
    // exatamente o servidor de produção. Localmente, preserva o fluxo rápido.
    command: webServerCommand,
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
