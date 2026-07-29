import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env.local", quiet: true });

if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL is not set in .env.local — see .env.example (a dedicated Neon branch or local Docker Postgres)."
  );
  process.exit(1);
}

const child = spawn("tsx", ["scripts/seed-users.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    SEED_DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
