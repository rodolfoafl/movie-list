export function ImdbLink({
  imdbId,
}: {
  imdbId: string | null | undefined;
}) {
  if (!imdbId) {
    return null;
  }

  return (
    <a
      href={`https://www.imdb.com/title/${imdbId}/`}
      target="_blank"
      rel="noopener"
      aria-label="Abrir página do filme no IMDb"
      title="Abrir página do filme no IMDb"
      className="rounded-sm text-sm text-ink-muted transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      IMDb
    </a>
  );
}
