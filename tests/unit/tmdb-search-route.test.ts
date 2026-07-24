import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("@/app/lib/tmdb", () => ({
  searchMovies: vi.fn().mockRejectedValue(new Error("TMDB fetch failed")),
}));

import { GET } from "@/app/api/tmdb/search/route";

describe("GET /api/tmdb/search — TMDB unavailable (FR-013)", () => {
  it("returns 503 { error: 'search_unavailable' } when the TMDB fetch fails or is non-2xx", async () => {
    const request = new Request("http://localhost/api/tmdb/search?q=matrix");

    const response = await GET(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "search_unavailable" });
  });
});
