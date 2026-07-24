import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createList } from "@/app/(lists)/actions";
import { db } from "@/app/lib/db/client";
import { lists } from "@/app/lib/db/schema";

function formDataWithName(name: string) {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

describe("createList — duplicate name rejection (FR-005)", () => {
  it("rejects a name that duplicates an existing list case/whitespace-insensitively, with no new row", async () => {
    const first = await createList(undefined, formDataWithName("Date Night"));
    expect(first).toBeUndefined();

    const second = await createList(undefined, formDataWithName(" date night "));
    expect(second?.error).toBeTruthy();

    const rows = await db.select().from(lists);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Date Night");
  });
});
