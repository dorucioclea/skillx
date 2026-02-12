import { useState, useEffect, useRef, useCallback } from "react";
import { LeaderboardTable } from "./leaderboard-table";

const PAGE_SIZE = 20;

interface LeaderboardEntry {
  rank: number;
  slug: string;
  name: string;
  author: string;
  installs: number;
  rating: number;
}

interface HomeLeaderboardProps {
  initialEntries: LeaderboardEntry[];
  initialHasMore: boolean;
}

export function HomeLeaderboard({
  initialEntries,
  initialHasMore,
}: HomeLeaderboardProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const entriesLengthRef = useRef(initialEntries.length);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/leaderboard?sort=installs&offset=${entriesLengthRef.current}&limit=${PAGE_SIZE}`
      );
      const data = (await res.json()) as {
        entries: LeaderboardEntry[];
        hasMore: boolean;
      };
      setEntries((prev) => {
        const updated = [...prev, ...data.entries];
        entriesLengthRef.current = updated.length;
        return updated;
      });
      hasMoreRef.current = data.hasMore;
      setHasMore(data.hasMore);
    } catch {
      // Silent fail — observer retries on next intersection
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

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

  return (
    <>
      <LeaderboardTable entries={entries} />

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
    </>
  );
}
