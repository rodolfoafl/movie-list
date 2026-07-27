import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));

import { getListsForMovie } from "@/app/search/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

const MATRIX_TMDB_ID = 603;

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

describe("getListsForMovie", () => {
  it("returns [] when zero lists exist", async () => {
    const result = await getListsForMovie(MATRIX_TMDB_ID);
    expect(result).toEqual([]);
  });

  it("returns one entry per list ordered by name, with alreadyInList reflecting movie_entries membership", async () => {
    const listB = await createTestList("zz-test-B List");
    const listA = await createTestList("zz-test-A List");

    await db.insert(movieEntries).values({
      listId: listA,
      tmdbId: MATRIX_TMDB_ID,
      title: "The Matrix",
      posterPath: null,
      releaseYear: 1999,
    });

    const result = await getListsForMovie(MATRIX_TMDB_ID);

    expect(result).toEqual([
      { id: listA, name: "zz-test-A List", alreadyInList: true },
      { id: listB, name: "zz-test-B List", alreadyInList: false },
    ]);
  });
});
