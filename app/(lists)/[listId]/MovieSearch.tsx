"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { addMovieToList } from "./actions";

export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string;
};

type SearchStatus = "idle" | "loading" | "success" | "error";
type AddStatus = "pending" | "added" | "duplicate";

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w200";
const DEBOUNCE_MS = 400;

export function MovieSearch({
  listId,
  existingTmdbIds,
}: {
  listId: string;
  existingTmdbIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [retryToken, setRetryToken] = useState(0);
  const [addStatuses, setAddStatuses] = useState<Record<number, AddStatus>>({});
  const [, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const alreadyInList = new Set(existingTmdbIds);

  function handleAdd(result: TmdbSearchResult) {
    setAddStatuses((prev) => ({ ...prev, [result.tmdbId]: "pending" }));
    startTransition(async () => {
      const outcome = await addMovieToList(listId, {
        tmdbId: result.tmdbId,
        title: result.title,
        posterPath: result.posterPath,
        releaseYear: result.releaseYear,
      });

      setAddStatuses((prev) => ({
        ...prev,
        [result.tmdbId]: outcome?.error ? "duplicate" : "added",
      }));
    });
  }

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      abortRef.current?.abort();
      return;
    }

    const timeoutId = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            setStatus("error");
            return;
          }
          const data = (await response.json()) as { results: TmdbSearchResult[] };
          setResults(data.results);
          setStatus("success");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, retryToken]);

  return (
    <section aria-labelledby="search-heading" className="mt-8">
      <h2 id="search-heading" className="text-lg font-medium text-black dark:text-zinc-50">
        Buscar filmes
      </h2>

      <label htmlFor="movie-search" className="sr-only">
        Buscar filmes por título
      </label>
      <input
        id="movie-search"
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (!value.trim()) {
            abortRef.current?.abort();
            setStatus("idle");
            setResults([]);
          }
        }}
        placeholder="Buscar por título..."
        className="mt-2 w-full rounded border border-black/15 px-3 py-2 text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
      />

      {status === "error" && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p>Não foi possível buscar filmes agora. Tente novamente.</p>
          <button
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
            className="mt-2 rounded border border-amber-400 px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Nenhum filme encontrado para essa busca.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((result) => {
            const addStatus = addStatuses[result.tmdbId];
            const isInList = alreadyInList.has(result.tmdbId) || addStatus === "added" || addStatus === "duplicate";
            const isPending = addStatus === "pending";

            return (
              <li
                key={result.tmdbId}
                className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  {result.posterPath ? (
                    <Image
                      src={`${TMDB_POSTER_BASE_URL}${result.posterPath}`}
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
                  <p className="font-medium text-black dark:text-zinc-50">
                    {result.title}
                    {result.releaseYear && (
                      <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                        ({result.releaseYear})
                      </span>
                    )}
                  </p>
                  <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {result.overview}
                  </p>
                </div>
                {isInList ? (
                  <span className="flex-shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                    Já está nesta lista
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdd(result)}
                    className="flex-shrink-0 rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
                  >
                    {isPending ? "Adicionando..." : "Adicionar"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
