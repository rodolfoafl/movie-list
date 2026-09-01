import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

const targetUrl = process.env.DRIZZLE_TARGET_URL;

if (!targetUrl) {
  throw new Error(
    "No target database configured. Set DRIZZLE_TARGET_URL before running drizzle-kit, e.g.\n" +
      '  DRIZZLE_TARGET_URL="$TEST_DATABASE_URL" npx drizzle-kit push\n' +
      "This config intentionally ignores DATABASE_URL so schema changes are never silently pushed to the app's default database."
  );
}

export default defineConfig({
  schema: "./app/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: targetUrl,
  },
});
