import { neon } from "@neondatabase/serverless";
import { afterEach } from "vitest";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set — see .env.example (a dedicated Neon branch or local Docker Postgres)."
  );
}

const sql = neon(process.env.TEST_DATABASE_URL);

afterEach(async () => {
  await sql`TRUNCATE TABLE movie_entries, lists, users RESTART IDENTITY CASCADE`;
});
