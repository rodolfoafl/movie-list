import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { users } from "../app/lib/db/schema";

function parseArgs(argv: string[]): { email: string; password: string }[] {
  const accounts: { email: string; password: string }[] = [];
  let pendingEmail: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") {
      pendingEmail = argv[++i];
    } else if (arg === "--password") {
      const password = argv[++i];
      if (!pendingEmail) {
        throw new Error("--password provided without a preceding --email");
      }
      accounts.push({ email: pendingEmail, password });
      pendingEmail = undefined;
    }
  }

  if (accounts.length === 0) {
    throw new Error(
      "No accounts provided. Usage: seed:users -- --database-url <url> --email <email> --password <password> [--email <email> --password <password> ...]"
    );
  }

  return accounts;
}

function parseDatabaseUrl(argv: string[]): string {
  const flagIndex = argv.indexOf("--database-url");
  const fromFlag = flagIndex !== -1 ? argv[flagIndex + 1] : undefined;
  const databaseUrl = fromFlag ?? process.env.SEED_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "No target database configured. Pass --database-url <url> or set SEED_DATABASE_URL.\n" +
        "This script intentionally ignores DATABASE_URL to avoid silently writing to the app's default database."
    );
  }

  return databaseUrl;
}

async function main() {
  const argv = process.argv.slice(2);
  const accounts = parseArgs(argv);
  const databaseUrl = parseDatabaseUrl(argv);

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  for (const { email, password } of accounts) {
    const passwordHash = await bcrypt.hash(password, 10);

    await db
      .insert(users)
      .values({ email, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash },
      });

    console.log(`Seeded user: ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
