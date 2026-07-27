import { config } from "dotenv";

config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { lists, movieEntries } from "../app/lib/db/schema";

const DATA_PATH = join(__dirname, "data", "movies_lists.json");
const ORPHANS_PATH = join(__dirname, "data", "migration-orphans.json");
const TMDB_FIND_URL = "https://api.themoviedb.org/3/find";
const TMDB_REQUEST_DELAY_MS = 250;

type LegacyMovie = {
  status?: boolean;
  name?: string;
  year?: string;
  imdbID?: string;
};

type LegacyList = {
  date?: { $date: string };
  name: string;
  movies?: LegacyMovie[];
};

type TmdbFindResult = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
};

type TmdbFindResponse = {
  movie_results?: TmdbFindResult[];
};

type OrphanCategory = "missing_imdb" | "no_tmdb_match" | "api_error";

type Orphan = {
  listName: string;
  movieName: string;
  year: string;
  imdbID: string;
  reason: string;
  category: OrphanCategory;
};

type Summary = {
  listsCreated: number;
  listsSkipped: number;
  entriesInserted: number;
  entriesSkipped: number;
  orphans: Orphan[];
};

const CONSECUTIVE_API_ERROR_LIMIT = 5;

class CircuitBreakerAbort extends Error {
  constructor(message: string, public summary: Summary) {
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

async function resolveTmdbId(
  imdbID: string | undefined,
  fallbackTitle: string
): Promise<{ tmdbId: number; title: string; releaseYear: number | null; posterPath: string | null } | null> {
  if (!imdbID) {
    return null;
  }

  const url = new URL(`${TMDB_FIND_URL}/${imdbID}`);
  url.searchParams.set("external_source", "imdb_id");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB /find failed for ${imdbID} with status ${response.status}`);
  }

  const data = (await response.json()) as TmdbFindResponse;
  const match = data.movie_results?.[0];

  if (!match) {
    return null;
  }

  return {
    tmdbId: match.id,
    title: match.title || fallbackTitle,
    releaseYear: match.release_date ? Number(match.release_date.slice(0, 4)) || null : null,
    posterPath: match.poster_path ?? null,
  };
}

async function migrate(db: ReturnType<typeof drizzle>): Promise<Summary> {
  const rawData = readFileSync(DATA_PATH, "utf-8");
  const legacyLists: LegacyList[] = JSON.parse(rawData);

  const summary: Summary = {
    listsCreated: 0,
    listsSkipped: 0,
    entriesInserted: 0,
    entriesSkipped: 0,
    orphans: [],
  };

  let consecutiveApiErrors = 0;
  let entriesProcessed = 0;

  for (const legacyList of legacyLists) {
    const listName = legacyList.name.trim();
    const fallbackWatchedAt = legacyList.date?.$date ? new Date(legacyList.date.$date) : null;

    const [insertedList] = await db
      .insert(lists)
      .values({ name: listName })
      .onConflictDoNothing()
      .returning({ id: lists.id });

    let listId = insertedList?.id;

    if (listId) {
      summary.listsCreated++;
    } else {
      summary.listsSkipped++;
      const [existingList] = await db
        .select({ id: lists.id })
        .from(lists)
        .where(sql`lower(trim(${lists.name})) = lower(trim(${listName}))`);
      listId = existingList?.id;
    }

    if (!listId) {
      throw new Error(`Could not resolve list id for "${listName}" after upsert`);
    }

    for (const movie of legacyList.movies ?? []) {
      const movieName = movie.name ?? "";
      const year = movie.year ?? "";
      const imdbID = movie.imdbID ?? "";
      entriesProcessed++;

      let resolved: Awaited<ReturnType<typeof resolveTmdbId>>;
      try {
        resolved = await resolveTmdbId(imdbID || undefined, movieName);
        consecutiveApiErrors = 0;
      } catch (error) {
        consecutiveApiErrors++;
        summary.orphans.push({
          listName,
          movieName,
          year,
          imdbID,
          reason: error instanceof Error ? error.message : "TMDB lookup failed",
          category: "api_error",
        });
        await sleep(TMDB_REQUEST_DELAY_MS);

        if (consecutiveApiErrors >= CONSECUTIVE_API_ERROR_LIMIT) {
          throw new CircuitBreakerAbort(
            `TMDB API appears broken — check TMDB_API_KEY / rate limit; ${entriesProcessed} entries processed before abort`,
            summary
          );
        }
        continue;
      }

      await sleep(TMDB_REQUEST_DELAY_MS);

      if (!resolved) {
        summary.orphans.push({
          listName,
          movieName,
          year,
          imdbID,
          reason: imdbID ? "No TMDB match for imdbID" : "Missing imdbID",
          category: imdbID ? "no_tmdb_match" : "missing_imdb",
        });
        continue;
      }

      const [insertedEntry] = await db
        .insert(movieEntries)
        .values({
          listId,
          tmdbId: resolved.tmdbId,
          title: resolved.title,
          posterPath: resolved.posterPath,
          releaseYear: resolved.releaseYear,
          watchedAt: movie.status ? fallbackWatchedAt : null,
        })
        .onConflictDoNothing({ target: [movieEntries.listId, movieEntries.tmdbId] })
        .returning({ id: movieEntries.id });

      if (insertedEntry) {
        summary.entriesInserted++;
      } else {
        summary.entriesSkipped++;
      }
    }
  }

  return summary;
}

function printSummary(summary: Summary): void {
  console.log("\n=== Migration summary ===");
  console.log(`Lists created:   ${summary.listsCreated}`);
  console.log(`Lists skipped:   ${summary.listsSkipped} (already existed)`);
  console.log(`Entries inserted: ${summary.entriesInserted}`);
  console.log(`Entries skipped:  ${summary.entriesSkipped} (already existed)`);
  console.log(`Orphans:          ${summary.orphans.length}`);
  console.log(`  - missing imdbID:  ${countByCategory(summary.orphans, "missing_imdb")}`);
  console.log(`  - no TMDB match:   ${countByCategory(summary.orphans, "no_tmdb_match")}`);
  console.log(`  - TMDB API errors: ${countByCategory(summary.orphans, "api_error")}`);

  if (summary.orphans.length > 0) {
    console.log("\n--- Orphans ---");
    for (const orphan of summary.orphans) {
      console.log(
        `  [${orphan.listName}] "${orphan.movieName}" (${orphan.year}) imdbID="${orphan.imdbID}" — ${orphan.reason}`
      );
    }
  }
}

async function main() {
  const databaseUrl = parseDatabaseUrl(process.argv.slice(2));

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient);

  let summary: Summary;
  try {
    summary = await migrate(db);
  } catch (error) {
    if (error instanceof CircuitBreakerAbort) {
      printSummary(error.summary);
      writeFileSync(ORPHANS_PATH, JSON.stringify(error.summary.orphans, null, 2));
      console.error(`\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  printSummary(summary);
  writeFileSync(ORPHANS_PATH, JSON.stringify(summary.orphans, null, 2));
  console.log(`\nOrphans written to ${ORPHANS_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
