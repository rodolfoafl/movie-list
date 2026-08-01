import { config } from "dotenv";

config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { eq, isNull } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { movieEntries } from "../app/lib/db/schema";
import { fetchExternalIds } from "../app/lib/tmdb";

const REPORT_PATH = join(__dirname, "data", "backfill-imdb-orphans.json");
const TMDB_REQUEST_DELAY_MS = 250;
const CONSECUTIVE_API_ERROR_LIMIT = 5;

type OrphanCategory = "no_tmdb_match" | "api_error";

type Orphan = {
  entryId: string;
  listId: string;
  title: string;
  tmdbId: number;
  reason: string;
  category: OrphanCategory;
};

type Report = {
  entriesScanned: number;
  entriesResolved: number;
  orphans: Orphan[];
};

class CircuitBreakerAbort extends Error {
  constructor(message: string, public report: Report) {
    super(message);
    this.name = "CircuitBreakerAbort";
  }
}

function countByCategory(orphans: Orphan[], category: OrphanCategory): number {
  return orphans.filter((orphan) => orphan.category === category).length;
}

function parseDatabaseUrl(argv: string[]): string {
  const flagIndex = argv.indexOf("--database-url");
  const fromFlag = flagIndex !== -1 ? argv[flagIndex + 1] : undefined;
  const databaseUrl = fromFlag ?? process.env.MIGRATION_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "No target database configured. Pass --database-url <url> or set MIGRATION_DATABASE_URL.\n" +
        "This script intentionally ignores DATABASE_URL to avoid silently writing to the app's default database."
    );
  }

  return databaseUrl;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfill(db: ReturnType<typeof drizzle>): Promise<Report> {
  const rows = await db
    .select({
      id: movieEntries.id,
      listId: movieEntries.listId,
      title: movieEntries.title,
      tmdbId: movieEntries.tmdbId,
    })
    .from(movieEntries)
    .where(isNull(movieEntries.imdbId));

  const report: Report = {
    entriesScanned: 0,
    entriesResolved: 0,
    orphans: [],
  };

  let consecutiveApiErrors = 0;

  for (const row of rows) {
    report.entriesScanned++;

    let imdbId: string | null;
    try {
      imdbId = await fetchExternalIds(row.tmdbId);
      consecutiveApiErrors = 0;
    } catch (error) {
      consecutiveApiErrors++;
      report.orphans.push({
        entryId: row.id,
        listId: row.listId,
        title: row.title,
        tmdbId: row.tmdbId,
        reason: error instanceof Error ? error.message : "TMDB lookup failed",
        category: "api_error",
      });
      await sleep(TMDB_REQUEST_DELAY_MS);

      if (consecutiveApiErrors >= CONSECUTIVE_API_ERROR_LIMIT) {
        throw new CircuitBreakerAbort(
          `TMDB API appears broken — check TMDB_API_KEY / rate limit; ${report.entriesScanned} entries scanned before abort`,
          report
        );
      }
      continue;
    }

    await sleep(TMDB_REQUEST_DELAY_MS);

    if (!imdbId) {
      report.orphans.push({
        entryId: row.id,
        listId: row.listId,
        title: row.title,
        tmdbId: row.tmdbId,
        reason: "No TMDB external_ids match",
        category: "no_tmdb_match",
      });
      continue;
    }

    await db
      .update(movieEntries)
      .set({ imdbId })
      .where(eq(movieEntries.id, row.id));

    report.entriesResolved++;
  }

  return report;
}

function printSummary(report: Report): void {
  console.log("\n=== Backfill summary ===");
  console.log(`Entries scanned:  ${report.entriesScanned}`);
  console.log(`Entries resolved: ${report.entriesResolved}`);
  console.log(`Orphans:          ${report.orphans.length}`);
  console.log(`  - no TMDB match:   ${countByCategory(report.orphans, "no_tmdb_match")}`);
  console.log(`  - TMDB API errors: ${countByCategory(report.orphans, "api_error")}`);

  if (report.orphans.length > 0) {
    console.log("\n--- Orphans ---");
    for (const orphan of report.orphans) {
      console.log(
        `  [${orphan.listId}] "${orphan.title}" (tmdbId=${orphan.tmdbId}) — ${orphan.reason}`
      );
    }
  }
}

async function main() {
  const databaseUrl = parseDatabaseUrl(process.argv.slice(2));

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient);

  let report: Report;
  try {
    report = await backfill(db);
  } catch (error) {
    if (error instanceof CircuitBreakerAbort) {
      printSummary(error.report);
      writeFileSync(REPORT_PATH, JSON.stringify(error.report, null, 2));
      console.error(`\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  printSummary(report);
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
