"use server";

import { asc, eq } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

export type ListSelection = {
  id: string;
  name: string;
  alreadyInList: boolean;
};

export async function getListsForMovie(
  tmdbId: number
): Promise<ListSelection[]> {
  await verifySession();

  const allLists = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .orderBy(asc(lists.name));

  const entries = await db
    .select({ listId: movieEntries.listId })
    .from(movieEntries)
    .where(eq(movieEntries.tmdbId, tmdbId));

  const listIdsWithMovie = new Set(entries.map((entry) => entry.listId));

  return allLists.map((list) => ({
    ...list,
    alreadyInList: listIdsWithMovie.has(list.id),
  }));
}
