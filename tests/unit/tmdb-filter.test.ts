import { afterEach, describe, expect, it, vi } from "vitest";

import { searchMovies } from "@/app/lib/tmdb";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchMovies — drops results without a usable id (CHK021)", () => {
  it("filters out a result with no usable id, keeping valid ones", async () => {
    const payload = {
      results: [
        {
          id: 603,
          title: "The Matrix",
          release_date: "1999-03-30",
          poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
          overview: "A computer hacker learns...",
        },
        {
          title: "No Id Movie",
          release_date: "2020-01-01",
          poster_path: null,
          overview: "Missing id.",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      })
    );

    const results = await searchMovies("matrix");

    expect(results).toHaveLength(1);
    expect(results[0].tmdbId).toBe(603);
    expect(results[0].title).toBe("The Matrix");
  });
});
