import { verifySession } from "@/app/lib/dal";

import { GlobalMovieSearch } from "./GlobalMovieSearch";

export default async function SearchPage() {
  await verifySession();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 p-6 dark:bg-black">
      <div className="mx-auto w-full max-w-2xl">
        <h1
          id="global-search-heading"
          className="text-2xl font-semibold text-black dark:text-zinc-50"
        >
          Buscar filmes
        </h1>

        <div className="mt-8">
          <GlobalMovieSearch />
        </div>
      </div>
    </div>
  );
}
