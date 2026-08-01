import { NextResponse } from "next/server";

import { verifySession } from "@/app/lib/dal";
import { resolveImdbId } from "@/app/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await verifySession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tmdbIdParam = searchParams.get("tmdbId");
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : NaN;

  if (!Number.isFinite(tmdbId)) {
    return NextResponse.json({ imdbId: null });
  }

  const imdbId = await resolveImdbId(tmdbId);
  return NextResponse.json({ imdbId });
}
