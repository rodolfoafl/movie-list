import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Vitest sets process.env.VITEST — route tests at TEST_DATABASE_URL so
// integration tests never touch the app's real DATABASE_URL.
const connectionString = process.env.VITEST
  ? process.env.TEST_DATABASE_URL!
  : process.env.DATABASE_URL!;

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
