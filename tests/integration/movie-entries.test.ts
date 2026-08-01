import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/app/lib/tmdb", () => ({
  resolveImdbId: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => unknown) => cb()),
}));

import { addMovieToList, removeMovieFromList } from "@/app/(lists)/[listId]/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";
import { resolveImdbId } from "@/app/lib/tmdb";
import { after } from "next/server";

const MATRIX = {
  tmdbId: 603,
  title: "The Matrix",
  posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  releaseYear: 1999,
};

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

describe("addMovieToList — duplicate movie-in-list rejection (FR-016)", () => {
  it("rejects adding a TMDB id already present in the list, creating no duplicate row", async () => {
    const listId = await createTestList("Sci-Fi Night");

    const first = await addMovieToList(listId, MATRIX);
    expect(first).toBeUndefined();

    const second = await addMovieToList(listId, MATRIX);
    expect(second?.error).toBe("already_in_list");

    const rows = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(rows).toHaveLength(1);
  });

  it("allows the same TMDB id independently in a second list — both persist and toggle independently (FR-017)", async () => {
    const listA = await createTestList("List A");
    const listB = await createTestList("List B");

    const addToA = await addMovieToList(listA, MATRIX);
    const addToB = await addMovieToList(listB, MATRIX);

    expect(addToA).toBeUndefined();
    expect(addToB).toBeUndefined();

    const rowsA = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listA));
    const rowsB = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listB));

    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0].tmdbId).toBe(MATRIX.tmdbId);
    expect(rowsB[0].tmdbId).toBe(MATRIX.tmdbId);
    expect(rowsA[0].id).not.toBe(rowsB[0].id);
  });
});

describe("addMovieToList — tri-state imdb_id handling (FR-007/FR-008/FR-023)", () => {
  beforeEach(() => {
    vi.mocked(resolveImdbId).mockReset().mockResolvedValue(null);
    vi.mocked(after).mockClear();
  });

  it("omitted imdbId: inserts imdb_id = null immediately, resolves it via a background after() task (FR-007)", async () => {
    const listId = await createTestList("US3 Omitted");
    let releaseResolveImdbId: (value: string | null) => void = () => {};
    const pending = new Promise<string | null>((resolve) => {
      releaseResolveImdbId = resolve;
    });
    vi.mocked(resolveImdbId).mockReturnValueOnce(pending);

    const result = await addMovieToList(listId, { ...MATRIX, imdbId: undefined });
    expect(result).toBeUndefined();

    // The background task has already synchronously called resolveImdbId
    // (via the mocked after()), but its promise is still unresolved, so
    // the follow-up UPDATE hasn't run yet — the row must still read null.
    const [rowRightAfter] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(rowRightAfter.imdbId).toBeNull();
    expect(resolveImdbId).toHaveBeenCalledTimes(1);
    expect(resolveImdbId).toHaveBeenCalledWith(MATRIX.tmdbId);

    releaseResolveImdbId("tt0133093");
    await vi.waitFor(async () => {
      const [row] = await db
        .select()
        .from(movieEntries)
        .where(eq(movieEntries.listId, listId));
      expect(row.imdbId).toBe("tt0133093");
    });
  });

  it("imdbId: null — stored directly, no fallback lookup, no background task scheduled (FR-023)", async () => {
    const listId = await createTestList("US3 Null Cache");

    const result = await addMovieToList(listId, { ...MATRIX, imdbId: null });
    expect(result).toBeUndefined();

    const [row] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(row.imdbId).toBeNull();
    expect(resolveImdbId).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("imdbId: a string — stored as-is, no fallback lookup, no background task scheduled (FR-023)", async () => {
    const listId = await createTestList("US3 String Cache");

    const result = await addMovieToList(listId, { ...MATRIX, imdbId: "tt0133093" });
    expect(result).toBeUndefined();

    const [row] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(row.imdbId).toBe("tt0133093");
    expect(resolveImdbId).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("a resolveImdbId that settles to null (simulated failure/no-match) never delays or fails the add (FR-008)", async () => {
    const listId = await createTestList("US3 Failure");
    let releaseResolveImdbId: (value: string | null) => void = () => {};
    const pending = new Promise<string | null>((resolve) => {
      releaseResolveImdbId = resolve;
    });
    vi.mocked(resolveImdbId).mockReturnValueOnce(pending);

    const result = await addMovieToList(listId, { ...MATRIX, imdbId: undefined });

    // addMovieToList has already resolved successfully while resolveImdbId's
    // own promise is still pending (not yet even settled to null) — proof
    // the add's completion is unconditional, not merely timeout-bounded.
    expect(result).toBeUndefined();
    expect(resolveImdbId).toHaveBeenCalledTimes(1);

    releaseResolveImdbId(null);
    await vi.waitFor(() => {
      expect(resolveImdbId).toHaveResolvedTimes(1);
    });

    const [row] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(row.imdbId).toBeNull();
  });
});

describe("removeMovieFromList — imdb_id cleanup (FR-013)", () => {
  it("deletes the row entirely (imdb_id gone, not merely nulled) when it had a non-null imdb_id", async () => {
    const listId = await createTestList("US-FR013 Removal");

    await addMovieToList(listId, { ...MATRIX, imdbId: "tt0133093" });
    const [inserted] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.listId, listId));
    expect(inserted.imdbId).toBe("tt0133093");

    await removeMovieFromList(inserted.id);

    const rowsAfterRemoval = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.id, inserted.id));
    expect(rowsAfterRemoval).toHaveLength(0);
  });
});
