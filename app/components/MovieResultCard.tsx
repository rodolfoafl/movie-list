import Image from "next/image";
import type { ReactNode } from "react";

import type { TmdbSearchResult } from "./useTmdbSearch";

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w200";

export function MovieResultCard({
  result,
  renderAction,
}: {
  result: TmdbSearchResult;
  renderAction: (result: TmdbSearchResult) => ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950">
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
      {renderAction(result)}
    </li>
  );
}
