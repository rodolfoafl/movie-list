import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env.local" });

if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL is not set in .env.local — see .env.example (a dedicated Neon branch or local Docker Postgres)."
  );
  process.exit(1);
}

const child = spawn("next", ["dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
