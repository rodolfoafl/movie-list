import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createImdbIdsCache } from "@/app/components/useImdbIds";

type Result = { tmdbId: number };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createImdbIdsCache — cache/cancel state machine (FR-014, FR-015, FR-016, FR-017, FR-021, FR-022)", () => {
  let abortSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    abortSpy = vi.spyOn(AbortController.prototype, "abort");
  });

  afterEach(() => {
    abortSpy.mockRestore();
  });

  it("fires a fetch for a previously-unseen tmdbId", () => {
    const fetchImdbId = vi.fn().mockReturnValue(new Promise(() => {}));
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    cache.sync([{ tmdbId: 603 }]);

    expect(fetchImdbId).toHaveBeenCalledTimes(1);
    expect(fetchImdbId).toHaveBeenCalledWith(603, expect.any(AbortSignal));
  });

  it("does not fetch an already-cached tmdbId, whether resolved or null (FR-014)", async () => {
    const resolved = deferred<string | null>();
    const fetchImdbId = vi.fn().mockReturnValueOnce(resolved.promise).mockReturnValueOnce(Promise.resolve(null));
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    cache.sync([{ tmdbId: 603 }, { tmdbId: 604 }]);
    resolved.resolve("tt0133093");
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.getCache()).toEqual({ 603: "tt0133093", 604: null });

    cache.sync([{ tmdbId: 603 }, { tmdbId: 604 }]);

    expect(fetchImdbId).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight fetch when results changes before it resolves (FR-015)", () => {
    const fetchImdbId = vi.fn().mockReturnValue(new Promise(() => {}));
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    cache.sync([{ tmdbId: 603 }]);
    expect(abortSpy).not.toHaveBeenCalled();

    cache.sync([{ tmdbId: 604 }]);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it("discards a resolution that arrives after being superseded — cache stays untouched for that id", async () => {
    const supersededResult = deferred<string | null>();
    const fetchImdbId = vi
      .fn()
      .mockReturnValueOnce(supersededResult.promise)
      .mockReturnValue(new Promise(() => {}));
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    cache.sync([{ tmdbId: 603 }]);
    cache.sync([{ tmdbId: 604 }].concat()); // supersede before the first fetch resolves
    supersededResult.resolve("tt0133093");
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.getCache()[603]).toBeUndefined();
  });

  it("never resets the cache between results changes — it only grows", async () => {
    const fetchImdbId = vi
      .fn()
      .mockResolvedValueOnce("tt0133093")
      .mockResolvedValueOnce("tt1375666");
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    cache.sync([{ tmdbId: 603 }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.getCache()).toEqual({ 603: "tt0133093" });

    cache.sync([{ tmdbId: 27205 }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.getCache()).toEqual({ 603: "tt0133093", 27205: "tt1375666" });
  });

  it("fires exactly N fetches for N previously-unseen results, minus whatever's already cached (finding E2)", async () => {
    const fetchImdbId = vi.fn().mockImplementation((tmdbId: number) => Promise.resolve(`tt-${tmdbId}`));
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    const firstBatch: Result[] = [{ tmdbId: 1 }, { tmdbId: 2 }, { tmdbId: 3 }];
    cache.sync(firstBatch);
    expect(fetchImdbId).toHaveBeenCalledTimes(3);
    await Promise.resolve();
    await Promise.resolve();

    fetchImdbId.mockClear();

    const secondBatch: Result[] = [{ tmdbId: 2 }, { tmdbId: 3 }, { tmdbId: 4 }, { tmdbId: 5 }];
    cache.sync(secondBatch);

    expect(fetchImdbId).toHaveBeenCalledTimes(2);
    expect(fetchImdbId).toHaveBeenCalledWith(4, expect.any(AbortSignal));
    expect(fetchImdbId).toHaveBeenCalledWith(5, expect.any(AbortSignal));
  });

  it("fires zero additional fetches when re-invoked with an unchanged results reference/content (finding E2)", async () => {
    const fetchImdbId = vi.fn().mockResolvedValue("tt0133093");
    const onCacheChange = vi.fn();
    const cache = createImdbIdsCache(fetchImdbId, onCacheChange);

    const results: Result[] = [{ tmdbId: 603 }];
    cache.sync(results);
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchImdbId).toHaveBeenCalledTimes(1);

    fetchImdbId.mockClear();
    cache.sync(results);

    expect(fetchImdbId).not.toHaveBeenCalled();
  });
});
