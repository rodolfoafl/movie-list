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

describe("getVisibleLists — unfiltered branch (contracts/lists-filter-query.md)", () => {
  it("returns all lists, ORDER BY name ASC, when filterValue is undefined", async () => {
    await createTestList("zz-test-Charlie");
    await createTestList("zz-test-Alpha");
    await createTestList("zz-test-Bravo");

    const result = await getVisibleLists(undefined);

    expect(result.map((row) => row.name)).toEqual([
      "zz-test-Alpha",
      "zz-test-Bravo",
      "zz-test-Charlie",
    ]);
  });

  it("treats whitespace-only input as no filter (Edge Cases)", async () => {
    await createTestList("zz-test-Halloween marathon");
    await createTestList("zz-test-Date night");

    const result = await getVisibleLists("   ");

    expect(result).toHaveLength(2);
  });
});

describe("getVisibleLists — case-insensitive substring match (FR-003, SC-002)", () => {
  it("matches regardless of the casing typed by the user", async () => {
    await createTestList("zz-test-Halloween marathon");
    await createTestList("zz-test-Date night");

    const result = await getVisibleLists("NIGHT");

    expect(result.map((row) => row.name)).toEqual(["zz-test-Date night"]);
  });

  it("matches regardless of the casing stored in the list name", async () => {
    await createTestList("zz-test-HALLOWEEN MARATHON");
    await createTestList("zz-test-Date night");

    const result = await getVisibleLists("hallo");

    expect(result.map((row) => row.name)).toEqual(["zz-test-HALLOWEEN MARATHON"]);
  });
});

describe("getVisibleLists — accent sensitivity (FR-003, spec.md Assumptions)", () => {
  it("does NOT match an unaccented filter against an accented stored name", async () => {
    await createTestList("zz-test-Sessão de cinema");

    const result = await getVisibleLists("sessao");

    expect(result).toHaveLength(0);
  });

  it("matches when the filter's accents match the stored name's accents", async () => {
    await createTestList("zz-test-Sessão de cinema");

    const result = await getVisibleLists("sessão");

    expect(result.map((row) => row.name)).toEqual(["zz-test-Sessão de cinema"]);
  });
});

describe("getVisibleLists — literal metacharacter matching (FR-013, SC-005)", () => {
  it("matches a literal '%' character with no wildcard interpretation", async () => {
    await createTestList("zz-test-100% Off deals");
    await createTestList("zz-test-Full price deals");

    const result = await getVisibleLists("100%");

    expect(result.map((row) => row.name)).toEqual(["zz-test-100% Off deals"]);
  });

  it("matches a literal '_' character with no single-char-wildcard interpretation", async () => {
    await createTestList("zz-test-under_score");
    await createTestList("zz-test-underXscore");

    const result = await getVisibleLists("under_score");

    expect(result.map((row) => row.name)).toEqual(["zz-test-under_score"]);
  });

  it("matches a literal backslash character with no escape interpretation", async () => {
    await createTestList("zz-test-back\\slash");
    await createTestList("zz-test-backslash");

    const result = await getVisibleLists("back\\slash");

    expect(result.map((row) => row.name)).toEqual(["zz-test-back\\slash"]);
  });
});

describe("getVisibleLists — ordering unchanged (FR-011)", () => {
  it("returns filtered matches in ORDER BY name ASC, not insertion order", async () => {
    await createTestList("zz-test-Charlie night");
    await createTestList("zz-test-Alpha night");
    await createTestList("zz-test-Bravo night");
    await createTestList("zz-test-No match here");

    const result = await getVisibleLists("night");

    expect(result.map((row) => row.name)).toEqual([
      "zz-test-Alpha night",
      "zz-test-Bravo night",
      "zz-test-Charlie night",
    ]);
  });
});
