import { asc } from "drizzle-orm";

import { verifySession } from "@/app/lib/dal";
import { db } from "@/app/lib/db/client";
import { lists } from "@/app/lib/db/schema";
import { logoutAction } from "@/app/login/actions";

import { CreateListForm } from "./CreateListForm";
import { ListRow } from "./ListRow";

export default async function ListsOverviewPage() {
  await verifySession();

  const allLists = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .orderBy(asc(lists.name));

  return (
    <div className="flex flex-1 flex-col bg-paper p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">
            Minhas listas
          </h1>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-ink-border/15 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Sair
            </button>
          </form>
        </div>

        <CreateListForm />

        {allLists.length === 0 ? (
          <p className="mt-8 text-ink-muted">
            Nenhuma lista criada ainda.
          </p>
        ) : (
          <ul className="mt-8 space-y-2">
            {allLists.map((list) => (
              <ListRow key={list.id} id={list.id} name={list.name} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
