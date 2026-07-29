import { useEffect, useRef, useState } from "react";

export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string;
};

export type TmdbSearchStatus = "idle" | "loading" | "success" | "error";

const DEBOUNCE_MS = 400;

export function useTmdbSearch(query: string) {
  const [status, setStatus] = useState<TmdbSearchStatus>("idle");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [retryToken, setRetryToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

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

  function retry() {
    setRetryToken((token) => token + 1);
  }

  function reset() {
    abortRef.current?.abort();
    setStatus("idle");
    setResults([]);
  }

  return { status, results, retry, reset };
}
