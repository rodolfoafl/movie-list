"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { isUniqueViolation } from "@/app/lib/db/errors";
import { movieEntries } from "@/app/lib/db/schema";

export type AddMovieState = { error?: string } | undefined;

export type MovieSnapshot = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
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

  try {
    await db.insert(movieEntries).values({
      listId,
      tmdbId: movie.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      releaseYear: movie.releaseYear,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "already_in_list" };
    }
    throw error;
  }

  revalidatePath(`/${listId}`);
}
