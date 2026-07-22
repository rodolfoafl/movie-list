import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          env: { DOTENV_CONFIG_PATH: ".env.local" },
          setupFiles: ["dotenv/config", "./tests/integration/setup.ts"],
        },
      },
    ],
  },
});
