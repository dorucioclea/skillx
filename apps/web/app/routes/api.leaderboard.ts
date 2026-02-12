/**
 * Paginated leaderboard API endpoint
 * GET /api/leaderboard?sort=rating&offset=0&limit=20
 * Returns { entries, hasMore }
 */

import type { LoaderFunctionArgs } from "react-router";
import { getDb } from "~/lib/db";
import { skills } from "~/lib/db/schema";
import { desc } from "drizzle-orm";
import { getCached } from "~/lib/cache/kv-cache";

const MAX_LIMIT = 50;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const db = getDb(env.DB);
  const url = new URL(request.url);

  const sort = url.searchParams.get("sort") || "rating";
  const offset = Math.max(
    0,
    parseInt(url.searchParams.get("offset") || "0", 10)
  );
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
    MAX_LIMIT
  );

  const orderCol =
    sort === "installs" ? skills.install_count : skills.avg_rating;
  const cacheKey = `leaderboard:page:${sort}:${offset}:${limit}`;

  const results = await getCached(env.KV, cacheKey, 300, async () => {
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
      .limit(limit + 1) // fetch one extra to determine hasMore
      .offset(offset);
  });

  const hasMore = results.length > limit;
  const entries = (hasMore ? results.slice(0, limit) : results).map(
    (e, i) => ({
      ...e,
      rank: offset + i + 1,
      installs: e.installs || 0,
      rating: e.rating || 0,
    })
  );

  return Response.json({ entries, hasMore });
}
