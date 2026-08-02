import { verifySession } from "@/app/lib/dal";
import { logoutAction } from "@/app/login/actions";

import { CreateListForm } from "./CreateListForm";
import { ListRow } from "./ListRow";
import { ListsFilterInput } from "./ListsFilterInput";
import { getVisibleLists } from "./queries";

export default async function ListsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await verifySession();

  const { q } = await searchParams;
  const visibleLists = await getVisibleLists(q);

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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <CreateListForm />
          <div className="order-first sm:order-none">
            <ListsFilterInput initialQuery={q ?? ""} />
          </div>
        </div>

        {visibleLists.length === 0 ? (
          <p className="mt-8 text-ink-muted">
            Nenhuma lista criada ainda.
          </p>
        ) : (
          <ul className="mt-8 space-y-2">
            {visibleLists.map((list) => (
              <ListRow key={list.id} id={list.id} name={list.name} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
