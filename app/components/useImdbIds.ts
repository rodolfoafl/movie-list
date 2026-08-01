import { useEffect, useState } from "react";

import type { TmdbSearchResult } from "./useTmdbSearch";

export type ImdbIdCache = Record<number, string | null>;

export type ImdbIdFetcher = (tmdbId: number, signal: AbortSignal) => Promise<string | null>;

async function fetchImdbId(tmdbId: number, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`/api/tmdb/external-ids?tmdbId=${tmdbId}`, { signal });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { imdbId: string | null };
    return data.imdbId;
  } catch {
    return null;
  }
}

// Cache/cancel logic lives outside the hook body so it's testable as a plain
// function — this project has no jsdom/testing-library to render a hook with.
export function createImdbIdsCache(
  fetcher: ImdbIdFetcher,
  onCacheChange: (cache: ImdbIdCache) => void
) {
  let cache: ImdbIdCache = {};
  let pending: AbortController[] = [];

  function sync(results: { tmdbId: number }[]) {
    cancelPending();

    const toFetch = results.filter((result) => !(result.tmdbId in cache));

    for (const result of toFetch) {
      const controller = new AbortController();
      pending.push(controller);

      fetcher(result.tmdbId, controller.signal).then((imdbId) => {
        if (controller.signal.aborted) {
          return;
        }
        cache = { ...cache, [result.tmdbId]: imdbId };
        onCacheChange(cache);
      });
    }
  }

  function cancelPending() {
    pending.forEach((controller) => controller.abort());
    pending = [];
  }

  function getCache() {
    return cache;
  }

  return { sync, cancelPending, getCache };
}

export function useImdbIds(results: TmdbSearchResult[]): ImdbIdCache {
  const [cache, setCache] = useState<ImdbIdCache>({});
  const [controller] = useState(() => createImdbIdsCache(fetchImdbId, setCache));

  useEffect(() => {
    controller.sync(results);
    return () => controller.cancelPending();
  }, [results, controller]);

  return cache;
}
