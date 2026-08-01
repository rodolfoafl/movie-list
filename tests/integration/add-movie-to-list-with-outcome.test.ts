import { describe, expect, it, vi } from "vitest";

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

import { eq } from "drizzle-orm";

import { addMovieToListWithOutcome } from "@/app/search/actions";
import type { MovieSnapshot } from "@/app/(lists)/[listId]/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

const MATRIX: MovieSnapshot = {
  tmdbId: 603,
  title: "The Matrix",
  posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  releaseYear: 1999,
};

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

describe("addMovieToListWithOutcome", () => {
  it("returns success and inserts the row when the list exists and doesn't yet contain the movie", async () => {
    const listId = await createTestList("zz-test-Sci-Fi Night");

    const outcome = await addMovieToListWithOutcome(listId, MATRIX);

    expect(outcome).toEqual({ status: "success" });
    const rows = await db.select().from(movieEntries).where(eq(movieEntries.listId, listId));
    expect(rows).toHaveLength(1);
  });

  it("returns success (not failure) when the movie is already in the list (FR-022)", async () => {
    const listId = await createTestList("zz-test-Already There");
    await addMovieToListWithOutcome(listId, MATRIX);

    const outcome = await addMovieToListWithOutcome(listId, MATRIX);

    expect(outcome).toEqual({ status: "success" });
    const rows = await db.select().from(movieEntries).where(eq(movieEntries.listId, listId));
    expect(rows).toHaveLength(1);
  });

  it("returns success (not a duplicate error) when another user concurrently added the movie between modal-open and confirmation (FR-022)", async () => {
    const listId = await createTestList("zz-test-Concurrent Add");
    // Simulates a second user's addMovieToList completing after this
    // caller's modal snapshot was taken but before it confirmed.
    await db.insert(movieEntries).values({
      listId,
      tmdbId: MATRIX.tmdbId,
      title: MATRIX.title,
      posterPath: MATRIX.posterPath,
      releaseYear: MATRIX.releaseYear,
    });

    const outcome = await addMovieToListWithOutcome(listId, MATRIX);

    expect(outcome).toEqual({ status: "success" });
    const rows = await db.select().from(movieEntries).where(eq(movieEntries.listId, listId));
    expect(rows).toHaveLength(1);
  });

  it('returns failure with "Lista não existe mais." when the list no longer exists (FR-021)', async () => {
    const listId = await createTestList("zz-test-Deleted Soon");
    await db.delete(lists).where(eq(lists.id, listId));

    const outcome = await addMovieToListWithOutcome(listId, MATRIX);

    expect(outcome).toEqual({
      status: "failure",
      reason: "Lista não existe mais.",
    });
  });

  it('returns failure with the generic reason when the insert throws an unexpected DB error (FR-023)', async () => {
    const listId = await createTestList("zz-test-Bad Insert");
    // title is NOT NULL in the schema — forcing a real (non-unique-violation)
    // DB error out of the unmodified addMovieToList, without mocking the DB.
    const invalidMovie = { ...MATRIX, title: null } as unknown as MovieSnapshot;

    const outcome = await addMovieToListWithOutcome(listId, invalidMovie);

    expect(outcome).toEqual({
      status: "failure",
      reason: "Não foi possível adicionar, tente novamente.",
    });
  });
});
