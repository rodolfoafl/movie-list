import Link from "next/link";
import { asc } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { lists } from "@/app/lib/db/schema";
import { logoutAction } from "@/app/login/actions";

import { CreateListForm } from "./CreateListForm";

export default async function ListsOverviewPage() {
  await verifySession();

  const allLists = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .orderBy(asc(lists.name));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 p-6 dark:bg-black">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Minhas listas
          </h1>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              Sair
            </button>
          </form>
        </div>

        <CreateListForm />

        {allLists.length === 0 ? (
          <p className="mt-8 text-zinc-600 dark:text-zinc-400">
            Nenhuma lista criada ainda.
          </p>
        ) : (
          <ul className="mt-8 space-y-2">
            {allLists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/${list.id}`}
                  className="block rounded-lg border border-black/10 bg-white p-4 text-black transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                >
                  {list.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
