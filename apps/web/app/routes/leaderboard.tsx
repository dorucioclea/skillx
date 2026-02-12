import { useState, useEffect, useRef, useCallback } from "react";
import type { Route } from "./+types/leaderboard";
import { PageContainer } from "../components/layout/page-container";
import { FilterTabs } from "../components/filter-tabs";
import { LeaderboardTable } from "../components/leaderboard-table";
import { getDb } from "~/lib/db";
import { skills } from "~/lib/db/schema";
import { desc } from "drizzle-orm";
import { getCached } from "~/lib/cache/kv-cache";

const PAGE_SIZE = 20;

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = getDb(env.DB);
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "rating";

  const orderCol =
    sort === "installs" ? skills.install_count : skills.avg_rating;

  const results = await getCached(
    env.KV,
    `leaderboard:page:${sort}:0:${PAGE_SIZE}`,
    300,
    async () => {
      return db
        .select({
          slug: skills.slug,
          name: skills.name,
          author: skills.author,
          installs: skills.install_count,
          rating: skills.avg_rating,
        })
        .from(skills)
        .orderBy(desc(orderCol))
        .limit(PAGE_SIZE + 1);
    }
  );

  const hasMore = results.length > PAGE_SIZE;
  const entries = (hasMore ? results.slice(0, PAGE_SIZE) : results).map(
    (e, i) => ({
      ...e,
      rank: i + 1,
      installs: e.installs || 0,
      rating: e.rating || 0,
    })
  );

  return { entries, hasMore, sort };
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const {
    entries: initialEntries,
    hasMore: initialHasMore,
    sort,
  } = loaderData;
  const [activeTab, setActiveTab] = useState("all");
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset state when loader data changes (sort change via URL navigation)
  const [prevSort, setPrevSort] = useState(sort);
  if (sort !== prevSort) {
    setPrevSort(sort);
    setEntries(initialEntries);
    setHasMore(initialHasMore);
  }

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/leaderboard?sort=${sort}&offset=${entries.length}&limit=${PAGE_SIZE}`
      );
      const data = (await res.json()) as {
        entries: typeof initialEntries;
        hasMore: boolean;
      };
      setEntries((prev) => [...prev, ...data.entries]);
      setHasMore(data.hasMore);
    } catch {
      // Silently fail — user can scroll again to retry
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, sort, entries.length]);

  // IntersectionObserver triggers loadMore when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSort = (column: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", column === "installs" ? "installs" : "rating");
    window.location.href = url.toString();
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="font-mono text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sx-fg-muted">Top rated AI agent skills.</p>
      </div>

      <div className="mb-6">
        <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <LeaderboardTable entries={entries} onSort={handleSort} />

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-sx-fg-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sx-border border-t-sx-accent" />
            Loading more...
          </div>
        )}
        {!hasMore && entries.length > 0 && (
          <p className="text-sm text-sx-fg-muted">All skills loaded.</p>
        )}
      </div>
    </PageContainer>
  );
}
