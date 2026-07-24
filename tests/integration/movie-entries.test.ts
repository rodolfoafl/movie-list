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
});
