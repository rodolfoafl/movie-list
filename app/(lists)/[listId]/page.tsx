import Link from "next/link";
import Image from "next/image";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";

import { toggleWatchedFormAction } from "./actions";
import { MovieSearch } from "./MovieSearch";

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w200";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  await verifySession();

  const { listId } = await params;

  const [list] = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  if (!list) {
    notFound();
  }

  const entries = await db
    .select()
    .from(movieEntries)
    .where(eq(movieEntries.listId, listId))
    .orderBy(sql`lower(${movieEntries.title})`);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 p-6 dark:bg-black">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="text-sm text-zinc-600 transition-colors hover:underline dark:text-zinc-400"
        >
          ← Minhas listas
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
          {list.name}
        </h1>

        <MovieSearch
          listId={list.id}
          existingTmdbIds={entries.map((entry) => entry.tmdbId)}
        />

        <section aria-labelledby="movies-heading" className="mt-8">
          <h2
            id="movies-heading"
            className="text-lg font-medium text-black dark:text-zinc-50"
          >
            Filmes
          </h2>

          {entries.length === 0 ? (
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Esta lista ainda não tem filmes. Busque acima para adicionar o
              primeiro.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
                >
                  <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                    {entry.posterPath ? (
                      <Image
                        src={`${TMDB_POSTER_BASE_URL}${entry.posterPath}`}
                        alt=""
                        width={64}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Sem imagem
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-black dark:text-zinc-50">
                      {entry.title}
                    </p>
                    {entry.releaseYear && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {entry.releaseYear}
                      </p>
                    )}
                    {entry.watchedAt && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Assistido em{" "}
                        {entry.watchedAt.toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <form
                    action={toggleWatchedFormAction.bind(null, entry.id)}
                    className="flex-shrink-0"
                  >
                    <button
                      type="submit"
                      className="rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
                    >
                      {entry.watchedAt ? "Marcar como não assistido" : "Marcar como assistido"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
