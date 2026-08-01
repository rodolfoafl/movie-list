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

import { redirect } from "next/navigation";

import { verifySession } from "@/app/lib/dal";
import { confirmAddToLists } from "@/app/search/actions";
import type { MovieSnapshot } from "@/app/(lists)/[listId]/actions";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

const verifySessionMock = vi.mocked(verifySession);

function captureRedirectError(path: string): unknown {
  try {
    redirect(path);
  } catch (error) {
    return error;
  }
  throw new Error("redirect() did not throw");
}

const MATRIX: MovieSnapshot = {
  tmdbId: 603,
  title: "The Matrix",
  posterPath: null,
  releaseYear: 1999,
};

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

describe("confirmAddToLists", () => {
  it("the top-level verifySession call is a constant +1, independent of listIds.length; nested per-list verifySession calls scale with N by design", async () => {
    verifySessionMock.mockClear();
    // Nonexistent listIds fail addMovieToListWithOutcome's existence check
    // before it ever reaches addMovieToList, so each contributes exactly one
    // *nested* verifySession call — isolating confirmAddToLists's own call
    // (the +1) as a constant, independent of listIds.length.
    const nonExistentIds = [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ];

    await confirmAddToLists(nonExistentIds, MATRIX);

    expect(verifySessionMock).toHaveBeenCalledTimes(1 + nonExistentIds.length);
  });

  it("zips each returned outcome with its correct listId", async () => {
    const listA = await createTestList("zz-test-List A");
    const listB = await createTestList("zz-test-List B");

    const outcomes = await confirmAddToLists([listA, listB], MATRIX);

    expect(outcomes).toEqual(
      expect.arrayContaining([
        { listId: listA, status: "success" },
        { listId: listB, status: "success" },
      ])
    );
    expect(outcomes).toHaveLength(2);
  });

  it("resolves an empty listIds array to [] with no DB writes", async () => {
    const outcomes = await confirmAddToLists([], MATRIX);

    expect(outcomes).toEqual([]);
    const rows = await db.select().from(movieEntries);
    expect(rows).toHaveLength(0);
  });

  it("propagates a redirect error thrown by a nested verifySession call instead of swallowing it as a generic failure", async () => {
    const listA = await createTestList("zz-test-List Redirect A");
    const listB = await createTestList("zz-test-List Redirect B");
    const listC = await createTestList("zz-test-List Redirect C");

    const redirectError = captureRedirectError("/login");

    verifySessionMock.mockClear();
    verifySessionMock.mockImplementation(async () => {
      // Call 1 is confirmAddToLists's own top-level verifySession. Calls 2+
      // are the nested per-list calls, invoked synchronously in listIds
      // order by Promise.allSettled's map — call 3 lands on listB, simulating
      // a session expiring mid-fan-out.
      if (verifySessionMock.mock.calls.length === 3) {
        throw redirectError;
      }
      return { userId: "00000000-0000-0000-0000-000000000000" };
    });

    await expect(
      confirmAddToLists([listA, listB, listC], MATRIX)
    ).rejects.toBe(redirectError);
  });
});
