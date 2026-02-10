import { useState } from "react";
import type { Route } from "./+types/leaderboard";
import { PageContainer } from "../components/layout/page-container";
import { FilterTabs } from "../components/filter-tabs";
import { LeaderboardTable } from "../components/leaderboard-table";
import { getDb } from "~/lib/db";
import { skills } from "~/lib/db/schema";
import { desc } from "drizzle-orm";
import { getCached } from "~/lib/cache/kv-cache";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = getDb(env.DB);
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "rating";

  // Cache key includes sort parameter
  const entries = await getCached(
    env.KV,
    `leaderboard:${sort}`,
    300,
    async () => {
      const orderCol =
        sort === "installs" ? skills.install_count : skills.avg_rating;

      const results = await db
        .select({
          slug: skills.slug,
          name: skills.name,
          author: skills.author,
          installs: skills.install_count,
          rating: skills.avg_rating,
        })
        .from(skills)
        .orderBy(desc(orderCol))
        .limit(50);

      return results;
    }
  );

  // Add rank numbers
  const ranked = entries.map((e, i) => ({
    ...e,
    rank: i + 1,
    installs: e.installs || 0,
    rating: e.rating || 0,
  }));

  return { entries: ranked };
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;
  const [activeTab, setActiveTab] = useState("all");

  const handleSort = (column: string) => {
    // Reload page with sort param
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
    </PageContainer>
  );
}
