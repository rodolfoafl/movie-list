export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  overview: string;
};

type TmdbApiResult = {
  id?: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type TmdbSearchResponse = {
  results?: TmdbApiResult[];
};

const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";

export async function searchMovies(query: string): Promise<TmdbSearchResult[]> {
  const url = new URL(TMDB_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("language", "pt-BR");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB search failed with status ${response.status}`);
  }

  const data = (await response.json()) as TmdbSearchResponse;

  return (data.results ?? [])
    .filter((result): result is TmdbApiResult & { id: number } => typeof result.id === "number")
    .map((result) => ({
      tmdbId: result.id,
      title: result.title ?? "",
      releaseYear: result.release_date
        ? Number(result.release_date.slice(0, 4)) || null
        : null,
      posterPath: result.poster_path ?? null,
      overview: result.overview ?? "",
    }));
}

type TmdbMovieWithExternalIdsResponse = {
  external_ids?: {
    imdb_id?: string | null;
  };
};

export async function fetchExternalIds(
  tmdbId: number,
  init?: RequestInit
): Promise<string | null> {
  const url = new URL(`${TMDB_MOVIE_URL}/${tmdbId}`);
  url.searchParams.set("append_to_response", "external_ids");

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB external_ids fetch failed with status ${response.status}`);
  }

  const data = (await response.json()) as TmdbMovieWithExternalIdsResponse;

  return data.external_ids?.imdb_id ?? null;
}

export async function resolveImdbId(tmdbId: number): Promise<string | null> {
  try {
    return await fetchExternalIds(tmdbId, { signal: AbortSignal.timeout(5000) });
  } catch {
    return null;
  }
}
