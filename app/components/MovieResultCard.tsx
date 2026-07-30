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
    <li className="flex items-center gap-3 rounded-lg border border-ink-border/10 bg-surface p-3">
      <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-decor/20">
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
        <p className="font-medium text-ink">
          {result.title}
          {result.releaseYear && (
            <span className="ml-1 font-normal text-ink-muted">
              ({result.releaseYear})
            </span>
          )}
        </p>
        <p className="line-clamp-2 text-sm text-ink-muted">
          {result.overview}
        </p>
      </div>
      {renderAction(result)}
    </li>
  );
}
