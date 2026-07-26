import { NextResponse } from "next/server";

import { verifySession } from "@/app/lib/dal";
import { searchMovies } from "@/app/lib/tmdb";

export async function GET(request: Request) {
  try {
    await verifySession();
  } catch {
    // verifySession() redirects unauthenticated callers for page navigation;
    // this is a fetch endpoint, so map that to a plain 401 instead (contracts/tmdb-search.md).
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMovies(query);
    return NextResponse.json({ results: results.slice(0, 10) });
  } catch {
    return NextResponse.json({ error: "search_unavailable" }, { status: 503 });
  }
}
