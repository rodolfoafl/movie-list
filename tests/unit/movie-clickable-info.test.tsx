import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MovieClickableInfo } from "@/app/components/MovieClickableInfo";

const BASE = {
  posterPath: null,
  title: "A Viagem de Chihiro",
  releaseYear: 2001,
  detail: "Uma menina entra no mundo dos espíritos.",
};

describe("MovieClickableInfo — left region interactivity by imdbId", () => {
  it("renders an anchor to the specific IMDb title page when imdbId is resolved", () => {
    const html = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId="tt0245429" />
    );

    expect(html).toContain('href="https://www.imdb.com/title/tt0245429/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('aria-label="Abrir página do filme no IMDb"');
  });

  // Reverses the original homepage-fallback decision. Asserting the ABSENCE
  // of an anchor rather than a specific href is deliberate: an assertion on
  // href="https://www.imdb.com/" is exactly what encoded the behavior this
  // change removes (F1, docs/production-smoke-test.md).
  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("renders no anchor at all when imdbId is %s", (_name, imdbId) => {
    const html = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId={imdbId} />
    );

    expect(html).not.toContain("<a ");
    expect(html).not.toContain("</a>");
    expect(html).not.toContain("imdb.com");
    expect(html).not.toContain("aria-label=");
    expect(html).not.toContain("target=");
    // The region itself carries no href. (A bare "href=" check would
    // false-positive on React's <link rel="preload"> for the poster.)
    expect(html).not.toMatch(/<div[^>]*\shref=/);
  });

  it("renders the same poster/title/detail content whether or not imdbId is present", () => {
    const linked = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId="tt0245429" />
    );
    const inert = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId={null} />
    );

    for (const html of [linked, inert]) {
      expect(html).toContain(BASE.title);
      expect(html).toContain("2001");
      expect(html).toContain(BASE.detail);
      expect(html).toContain("/poster-placeholder.svg");
    }
  });

  it("shows the hover/focus ExternalLink icon only in the linked case", () => {
    const linked = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId="tt0245429" />
    );
    const inert = renderToStaticMarkup(
      <MovieClickableInfo {...BASE} imdbId={null} />
    );

    expect(linked).toContain("group-focus-visible:opacity-100");
    expect(inert).not.toContain("group-focus-visible:opacity-100");
    expect(inert).not.toContain("<svg");
  });
});
