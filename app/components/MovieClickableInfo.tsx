import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w200";

export function MovieClickableInfo({
  posterPath,
  title,
  releaseYear,
  imdbId,
  detail,
}: {
  posterPath: string | null;
  title: string;
  releaseYear?: number | null;
  imdbId?: string | null;
  detail?: ReactNode;
}) {
  const href = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : "https://www.imdb.com/";
  const label = imdbId
    ? "Abrir página do filme no IMDb"
    : "Abrir IMDb";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      title={label}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-l-lg p-3 transition-colors hover:bg-decor/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-decor/20">
        {posterPath ? (
          <Image
            src={`${TMDB_POSTER_BASE_URL}${posterPath}`}
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
        <p className="font-medium text-ink">{title}</p>
        {releaseYear && (
          <p className="text-sm text-ink-muted">{releaseYear}</p>
        )}
        {detail && <div className="text-sm text-ink-muted">{detail}</div>}
      </div>
      <ExternalLink
        aria-hidden="true"
        className="h-4 w-4 flex-shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </a>
  );
}
