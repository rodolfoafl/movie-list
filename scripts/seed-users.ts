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
      "No accounts provided. Usage: seed:users -- --email <email> --password <password> [--email <email> --password <password> ...]"
    );
  }

  return accounts;
}

async function main() {
  const accounts = parseArgs(process.argv.slice(2));

  const sql = neon(process.env.DATABASE_URL!);
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
