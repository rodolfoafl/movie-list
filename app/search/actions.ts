"use server";

import { asc, eq } from "drizzle-orm";

import { addMovieToList, type MovieSnapshot } from "@/app/(lists)/[listId]/actions";
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

export type AddMovieOutcome =
  | { status: "success" }
  | { status: "failure"; reason: string };

const LIST_NOT_FOUND_REASON = "Lista não existe mais.";
const GENERIC_FAILURE_REASON = "Não foi possível adicionar, tente novamente.";

export async function addMovieToListWithOutcome(
  listId: string,
  movie: MovieSnapshot
): Promise<AddMovieOutcome> {
  await verifySession();

  const [existingList] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  if (!existingList) {
    return { status: "failure", reason: LIST_NOT_FOUND_REASON };
  }

  try {
    await addMovieToList(listId, movie);
    return { status: "success" };
  } catch {
    return { status: "failure", reason: GENERIC_FAILURE_REASON };
  }
}
