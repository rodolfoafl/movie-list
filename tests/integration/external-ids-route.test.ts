import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" }),
}));
vi.mock("@/app/lib/tmdb", () => ({ resolveImdbId: vi.fn() }));

import { verifySession } from "@/app/lib/dal";
import { resolveImdbId } from "@/app/lib/tmdb";
import { GET } from "@/app/api/tmdb/external-ids/route";

describe("GET /api/tmdb/external-ids", () => {
  beforeEach(() => {
    vi.mocked(verifySession).mockReset().mockResolvedValue({ userId: "00000000-0000-0000-0000-000000000000" });
    vi.mocked(resolveImdbId).mockReset();
  });

  it("returns 401 { error: 'unauthenticated' } when verifySession rejects", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(new Error("no session"));

    const response = await GET(new Request("http://localhost/api/tmdb/external-ids?tmdbId=603"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(resolveImdbId).not.toHaveBeenCalled();
  });

  it("returns 200 { imdbId: null } without calling resolveImdbId when tmdbId is missing", async () => {
    const response = await GET(new Request("http://localhost/api/tmdb/external-ids"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imdbId: null });
    expect(resolveImdbId).not.toHaveBeenCalled();
  });

  it("returns 200 { imdbId: null } without calling resolveImdbId when tmdbId is non-numeric", async () => {
    const response = await GET(new Request("http://localhost/api/tmdb/external-ids?tmdbId=abc"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imdbId: null });
    expect(resolveImdbId).not.toHaveBeenCalled();
  });

  it("returns 200 { imdbId } from resolveImdbId when tmdbId is a valid number", async () => {
    vi.mocked(resolveImdbId).mockResolvedValueOnce("tt0133093");

    const response = await GET(new Request("http://localhost/api/tmdb/external-ids?tmdbId=603"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imdbId: "tt0133093" });
    expect(resolveImdbId).toHaveBeenCalledWith(603);
  });

  it("returns 200 { imdbId: null }, never 503, when resolveImdbId collapses a TMDB failure to null", async () => {
    vi.mocked(resolveImdbId).mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/tmdb/external-ids?tmdbId=603"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imdbId: null });
  });
});
