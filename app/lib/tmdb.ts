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
