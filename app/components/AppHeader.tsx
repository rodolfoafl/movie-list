import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <nav className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 transition-colors hover:text-black dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Minhas listas
        </Link>
        <Link
          href="/search"
          className="text-sm font-medium text-zinc-700 transition-colors hover:text-black dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Buscar filmes
        </Link>
      </nav>
    </header>
  );
}
