import Link from "next/link";
import Image from "next/image";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { lists, movieEntries } from "@/app/lib/db/schema";
import { ImdbLink } from "@/app/components/ImdbLink";

import { MovieSearch } from "./MovieSearch";
import { WatchedToggle } from "./WatchedToggle";

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w200";

type WatchedFilter = "all" | "to-watch" | "watched";

const FILTERS: { value: WatchedFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "to-watch", label: "A assistir" },
  { value: "watched", label: "Assistidos" },
];

function parseFilter(status: string | undefined): WatchedFilter {
  return status === "to-watch" || status === "watched" ? status : "all";
}

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  await verifySession();

  const { listId } = await params;
  const filter = parseFilter((await searchParams).status);

  const [list] = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  if (!list) {
    notFound();
  }

  const existingEntries = await db
    .select({ tmdbId: movieEntries.tmdbId })
    .from(movieEntries)
    .where(eq(movieEntries.listId, listId));

  const hasEntries = existingEntries.length > 0;

  const watchedCondition =
    filter === "watched"
      ? isNotNull(movieEntries.watchedAt)
      : filter === "to-watch"
        ? isNull(movieEntries.watchedAt)
        : undefined;

  const visibleEntries = await db
    .select()
    .from(movieEntries)
    .where(
      watchedCondition
        ? and(eq(movieEntries.listId, listId), watchedCondition)
        : eq(movieEntries.listId, listId)
    )
    .orderBy(sql`lower(${movieEntries.title})`);

  return (
    <div className="flex flex-1 flex-col bg-paper p-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="rounded-sm text-sm text-ink-muted transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          ← Minhas listas
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-ink">
          {list.name}
        </h1>

        <MovieSearch
          listId={list.id}
          existingTmdbIds={existingEntries.map((entry) => entry.tmdbId)}
        />

        <section aria-labelledby="movies-heading" className="mt-8">
          <h2
            id="movies-heading"
            className="text-lg font-medium text-ink"
          >
            Filmes
          </h2>

          {hasEntries && (
            <nav
              aria-label="Filtrar por status de assistido"
              className="mt-4 flex gap-2"
            >
              {FILTERS.map((option) => (
                <Link
                  key={option.value}
                  href={
                    option.value === "all"
                      ? `/${list.id}`
                      : `/${list.id}?status=${option.value}`
                  }
                  aria-current={filter === option.value ? "true" : undefined}
                  className={`rounded border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                    filter === option.value
                      ? "border-ink bg-ink text-paper"
                      : "border-ink-border/15 text-ink-soft hover:bg-ink/5"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          )}

          {!hasEntries ? (
            <p className="mt-4 text-ink-muted">
              Esta lista ainda não tem filmes. Busque acima para adicionar o
              primeiro.
            </p>
          ) : visibleEntries.length === 0 ? (
            <p className="mt-4 text-ink-muted">
              Nenhum filme corresponde a este filtro.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visibleEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-ink-border/10 bg-surface p-3"
                >
                  <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-decor/20">
                    {entry.posterPath ? (
                      <Image
                        src={`${TMDB_POSTER_BASE_URL}${entry.posterPath}`}
                        alt=""
                        width={64}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/poster-placeholder.svg"
                        alt=""
                        width={64}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {entry.title}
                    </p>
                    {entry.releaseYear && (
                      <p className="text-sm text-ink-muted">
                        {entry.releaseYear}
                      </p>
                    )}
                    {entry.watchedAt && (
                      <p className="text-sm text-success">
                        Assistido em{" "}
                        {entry.watchedAt.toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <ImdbLink imdbId={entry.imdbId} />
                  <WatchedToggle
                    entryId={entry.id}
                    title={entry.title}
                    watched={entry.watchedAt !== null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
