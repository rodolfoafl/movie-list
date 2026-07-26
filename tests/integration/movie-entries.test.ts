import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { addMovieToList } from "@/app/(lists)/[listId]/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

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
