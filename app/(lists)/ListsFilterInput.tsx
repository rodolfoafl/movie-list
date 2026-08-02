"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

export function ListsFilterInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the debounce on mount — initialQuery already matches the URL
    // it came from, so there's nothing to write back yet.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const trimmed = value.trim();
    const timeoutId = setTimeout(() => {
      router.replace(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [value, router]);

  return (
    <div>
      <label htmlFor="lists-filter" className="sr-only">
        Filtrar listas
      </label>
      <input
        id="lists-filter"
        name="q"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Filtrar listas..."
        className="w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      />
    </div>
  );
}
