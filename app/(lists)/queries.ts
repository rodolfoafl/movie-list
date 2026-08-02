import { asc, sql } from "drizzle-orm";

import { db } from "@/app/lib/db/client";
import { lists } from "@/app/lib/db/schema";

export async function getVisibleLists(
  filterValue: string | undefined
): Promise<{ id: string; name: string }[]> {
  const trimmed = (filterValue ?? "").trim();
  const condition =
    trimmed === ""
      ? undefined
      : sql`position(lower(${trimmed}) in lower(${lists.name})) > 0`;

  return db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(condition)
    .orderBy(asc(lists.name));
}

export async function hasAnyLists(): Promise<boolean> {
  const rows = await db.select({ id: lists.id }).from(lists).limit(1);
  return rows.length > 0;
}
