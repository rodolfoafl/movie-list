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
  // Padding lives on the wrapper itself (the <a> in the linked case), never
  // on an outer <div> — otherwise the region's whitespace looks clickable
  // but isn't. Shared so both branches stay in lockstep.
  const wrapperClassName =
    "group flex min-w-0 flex-1 items-center gap-3 rounded-l-lg p-3";
  const linkClassName = `${wrapperClassName} transition-colors hover:bg-decor/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface`;

  const content = (
    <>
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
    </>
  );

  // No imdbId — commonly a near-empty TMDB stub with no external ids of any
  // kind, so there is no IMDb page to link to. Render the same content in an
  // inert <div>: no href, no aria-label (nothing interactive to name), no
  // hover/focus icon. Linking these to the IMDb homepage instead misleads —
  // see specs/whole-card-imdb-link/decision.md §3 and F1 in
  // docs/production-smoke-test.md.
  if (!imdbId) {
    return <div className={wrapperClassName}>{content}</div>;
  }

  const label = "Abrir página do filme no IMDb";

  return (
    <a
      href={`https://www.imdb.com/title/${imdbId}/`}
      target="_blank"
      rel="noopener"
      aria-label={label}
      title={label}
      className={linkClassName}
    >
      {content}
      <ExternalLink
        aria-hidden="true"
        className="h-4 w-4 flex-shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </a>
  );
}
