import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { toggleWatched } from "@/app/(lists)/[listId]/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

async function createTestEntry(listId: string) {
  const [row] = await db
    .insert(movieEntries)
    .values({
      listId,
      tmdbId: 603,
      title: "The Matrix",
      posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      releaseYear: 1999,
    })
    .returning({ id: movieEntries.id });
  return row.id;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

describe("toggleWatched — watched date lifecycle (FR-020)", () => {
  it("marks watched with today's date, clears it on unmark, and records a NEW date on re-mark", async () => {
    const listId = await createTestList("Watch Party");
    const entryId = await createTestEntry(listId);

    await toggleWatched(entryId);

    const [afterMark] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.id, entryId));
    expect(afterMark.watchedAt).not.toBeNull();
    expect(isToday(afterMark.watchedAt as Date)).toBe(true);

    const firstWatchedAt = afterMark.watchedAt as Date;

    await toggleWatched(entryId);

    const [afterUnmark] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.id, entryId));
    expect(afterUnmark.watchedAt).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 10));

    await toggleWatched(entryId);

    const [afterRemark] = await db
      .select()
      .from(movieEntries)
      .where(eq(movieEntries.id, entryId));
    expect(afterRemark.watchedAt).not.toBeNull();
    expect(isToday(afterRemark.watchedAt as Date)).toBe(true);
    expect((afterRemark.watchedAt as Date).getTime()).toBeGreaterThan(
      firstWatchedAt.getTime()
    );
  });
});
