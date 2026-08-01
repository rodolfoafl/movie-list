"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { isUniqueViolation } from "@/app/lib/db/errors";
import { movieEntries } from "@/app/lib/db/schema";
import { resolveImdbId } from "@/app/lib/tmdb";

export type AddMovieState = { error?: string } | undefined;

export type MovieSnapshot = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  imdbId?: string | null;
};

export async function addMovieToList(
  listId: string,
  movie: MovieSnapshot
): Promise<AddMovieState> {
  await verifySession();

  const [existing] = await db
    .select({ id: movieEntries.id })
    .from(movieEntries)
    .where(
      and(
        eq(movieEntries.listId, listId),
        eq(movieEntries.tmdbId, movie.tmdbId)
      )
    )
    .limit(1);

  if (existing) {
    return { error: "already_in_list" };
  }

  let entryId: string;

  try {
    const [inserted] = await db
      .insert(movieEntries)
      .values({
        listId,
        tmdbId: movie.tmdbId,
        title: movie.title,
        posterPath: movie.posterPath,
        releaseYear: movie.releaseYear,
        imdbId: movie.imdbId === undefined ? null : movie.imdbId,
      })
      .returning({ id: movieEntries.id });
    entryId = inserted.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "already_in_list" };
    }
    throw error;
  }

  if (movie.imdbId === undefined) {
    after(async () => {
      const imdbId = await resolveImdbId(movie.tmdbId);
      if (imdbId) {
        await db
          .update(movieEntries)
          .set({ imdbId })
          .where(eq(movieEntries.id, entryId));
      }
    });
  }

  revalidatePath(`/${listId}`);
}

export async function removeMovieFromList(entryId: string): Promise<void> {
  await verifySession();

  const [entry] = await db
    .delete(movieEntries)
    .where(eq(movieEntries.id, entryId))
    .returning({ listId: movieEntries.listId });

  if (entry) {
    revalidatePath(`/${entry.listId}`);
  }
}

export type ToggleWatchedState = { error?: string } | undefined;

export async function toggleWatched(
  entryId: string
): Promise<ToggleWatchedState> {
  await verifySession();

  const [entry] = await db
    .select({ id: movieEntries.id, listId: movieEntries.listId, watchedAt: movieEntries.watchedAt })
    .from(movieEntries)
    .where(eq(movieEntries.id, entryId))
    .limit(1);

  if (!entry) {
    return { error: "already_removed" };
  }

  await db
    .update(movieEntries)
    .set({ watchedAt: entry.watchedAt ? null : new Date() })
    .where(eq(movieEntries.id, entryId));

  revalidatePath(`/${entry.listId}`);
}

export async function toggleWatchedAction(
  entryId: string
): Promise<ToggleWatchedState> {
  return toggleWatched(entryId);
}
