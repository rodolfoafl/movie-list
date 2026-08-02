import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));

import { getVisibleLists } from "@/app/(lists)/queries";
import { db } from "@/app/lib/db/client";
import { lists } from "@/app/lib/db/schema";

async function createTestList(name: string) {
  const [row] = await db.insert(lists).values({ name }).returning({ id: lists.id });
  return row.id;
}

// The shared TEST_DATABASE_URL can carry stray rows from manual QA sessions
// that ran outside vitest's afterEach truncate cycle — filter every result
// down to the exact ids this test itself created, never assume the table
// contains only what this test inserted.
function among(result: { id: string; name: string }[], ids: string[]) {
  const idSet = new Set(ids);
  return result.filter((row) => idSet.has(row.id));
}

describe("getVisibleLists — unfiltered branch (contracts/lists-filter-query.md)", () => {
  it("returns all lists, ORDER BY name ASC, when filterValue is undefined", async () => {
    const charlieId = await createTestList("zz-test-Charlie");
    const alphaId = await createTestList("zz-test-Alpha");
    const bravoId = await createTestList("zz-test-Bravo");

    const result = await getVisibleLists(undefined);

    expect(among(result, [charlieId, alphaId, bravoId]).map((row) => row.name)).toEqual([
      "zz-test-Alpha",
      "zz-test-Bravo",
      "zz-test-Charlie",
    ]);
  });

  it("treats whitespace-only input as no filter (Edge Cases)", async () => {
    const marathonId = await createTestList("zz-test-Halloween marathon");
    const nightId = await createTestList("zz-test-Date night");

    const result = await getVisibleLists("   ");

    expect(among(result, [marathonId, nightId]).map((row) => row.name)).toEqual([
      "zz-test-Date night",
      "zz-test-Halloween marathon",
    ]);
  });
});

describe("getVisibleLists — case-insensitive substring match (FR-003, SC-002)", () => {
  it("matches regardless of the casing typed by the user", async () => {
    const marathonId = await createTestList("zz-test-Halloween marathon");
    const nightId = await createTestList("zz-test-Date night");

    const result = await getVisibleLists("NIGHT");

    expect(among(result, [marathonId, nightId]).map((row) => row.name)).toEqual([
      "zz-test-Date night",
    ]);
  });

  it("matches regardless of the casing stored in the list name", async () => {
    const marathonId = await createTestList("zz-test-HALLOWEEN MARATHON");
    const nightId = await createTestList("zz-test-Date night");

    const result = await getVisibleLists("hallo");

    expect(among(result, [marathonId, nightId]).map((row) => row.name)).toEqual([
      "zz-test-HALLOWEEN MARATHON",
    ]);
  });
});

describe("getVisibleLists — accent sensitivity (FR-003, spec.md Assumptions)", () => {
  it("does NOT match an unaccented filter against an accented stored name", async () => {
    const sessionId = await createTestList("zz-test-Sessão de cinema");

    const result = await getVisibleLists("sessao");

    expect(among(result, [sessionId])).toHaveLength(0);
  });

  it("matches when the filter's accents match the stored name's accents", async () => {
    const sessionId = await createTestList("zz-test-Sessão de cinema");

    const result = await getVisibleLists("sessão");

    expect(among(result, [sessionId]).map((row) => row.name)).toEqual([
      "zz-test-Sessão de cinema",
    ]);
  });
});

describe("getVisibleLists — literal metacharacter matching (FR-013, SC-005)", () => {
  it("matches a literal '%' character with no wildcard interpretation", async () => {
    const percentId = await createTestList("zz-test-100% Off deals");
    const fullPriceId = await createTestList("zz-test-Full price deals");

    const result = await getVisibleLists("100%");

    expect(among(result, [percentId, fullPriceId]).map((row) => row.name)).toEqual([
      "zz-test-100% Off deals",
    ]);
  });

  it("matches a literal '_' character with no single-char-wildcard interpretation", async () => {
    const underscoreId = await createTestList("zz-test-under_score");
    const anyCharId = await createTestList("zz-test-underXscore");

    const result = await getVisibleLists("under_score");

    expect(among(result, [underscoreId, anyCharId]).map((row) => row.name)).toEqual([
      "zz-test-under_score",
    ]);
  });

  it("matches a literal backslash character with no escape interpretation", async () => {
    const backslashId = await createTestList("zz-test-back\\slash");
    const noBackslashId = await createTestList("zz-test-backslash");

    const result = await getVisibleLists("back\\slash");

    expect(among(result, [backslashId, noBackslashId]).map((row) => row.name)).toEqual([
      "zz-test-back\\slash",
    ]);
  });
});

describe("getVisibleLists — ordering unchanged (FR-011)", () => {
  it("returns filtered matches in ORDER BY name ASC, not insertion order", async () => {
    const charlieId = await createTestList("zz-test-Charlie night");
    const alphaId = await createTestList("zz-test-Alpha night");
    const bravoId = await createTestList("zz-test-Bravo night");
    const noMatchId = await createTestList("zz-test-No match here");

    const result = await getVisibleLists("night");

    expect(
      among(result, [charlieId, alphaId, bravoId, noMatchId]).map((row) => row.name)
    ).toEqual(["zz-test-Alpha night", "zz-test-Bravo night", "zz-test-Charlie night"]);
  });
});
