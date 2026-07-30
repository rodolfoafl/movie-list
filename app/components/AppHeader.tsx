import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  return (
    <header className="border-b border-on-primary/10 bg-primary">
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          <Clapperboard size={20} aria-hidden="true" />
          B&R Filmes
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-sm text-sm font-medium text-on-primary transition-[text-decoration] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Listas
          </Link>
          <Link
            href="/search"
            className="rounded-sm text-sm font-medium text-on-primary transition-[text-decoration] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Filmes
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
