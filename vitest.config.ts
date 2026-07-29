import path from "node:path";

import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias, which Vitest doesn't
// pick up from tsconfig automatically.
const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          env: { DOTENV_CONFIG_PATH: ".env.local", DOTENV_CONFIG_QUIET: "true" },
          setupFiles: ["dotenv/config", "./tests/integration/setup.ts"],
          // Integration test files share one real TEST_DATABASE_URL and each
          // truncates tables in afterEach; running files in parallel lets
          // one file's truncate wipe another's in-progress rows.
          fileParallelism: false,
        },
      },
    ],
  },
});
