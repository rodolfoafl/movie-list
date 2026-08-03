import type { ReactNode } from "react";

import { MovieClickableInfo } from "./MovieClickableInfo";
import type { TmdbSearchResult } from "./useTmdbSearch";

export function MovieResultCard({
  result,
  imdbId,
  renderAction,
}: {
  result: TmdbSearchResult;
  imdbId?: string | null;
  renderAction: (result: TmdbSearchResult) => ReactNode;
}) {
  return (
    <li className="flex items-center rounded-lg border border-ink-border/10 bg-surface">
      <MovieClickableInfo
        posterPath={result.posterPath}
        title={result.title}
        releaseYear={result.releaseYear}
        imdbId={imdbId}
        detail={<p className="line-clamp-2">{result.overview}</p>}
      />
      <div className="flex flex-shrink-0 items-center gap-2 rounded-r-lg border-l border-ink-border/20 p-3">
        {renderAction(result)}
      </div>
    </li>
  );
}
