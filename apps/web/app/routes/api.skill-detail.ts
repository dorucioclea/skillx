import type { LoaderFunctionArgs } from "react-router";
import { getDb } from "~/lib/db";
import { skills, ratings, reviews, favorites } from "~/lib/db/schema";
import { eq, desc, count, avg } from "drizzle-orm";
import { getSession } from "~/lib/auth/session-helpers";

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  try {
    const slug = params.slug;
    if (!slug) {
      return Response.json({ error: "Skill slug is required" }, { status: 400 });
    }

    const env = context.cloudflare.env as Env;
    const db = getDb(env.DB);

    // Fetch skill data
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, slug))
      .limit(1);

    if (!skill) {
      return Response.json({ error: "Skill not found" }, { status: 404 });
    }

    // Fetch reviews with limit
    const skillReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.skill_id, skill.id))
      .orderBy(desc(reviews.created_at))
      .limit(50);

    // Calculate rating summary
    const ratingData = await db
      .select({
        avgRating: avg(ratings.score),
        ratingCount: count(ratings.id),
      })
      .from(ratings)
      .where(eq(ratings.skill_id, skill.id))
      .get();

    // Check if current user has favorited (if authenticated)
    let isFavorited = false;
    const session = await getSession(request, env);
    if (session?.user?.id) {
      const [favorite] = await db
        .select()
        .from(favorites)
        .where(eq(favorites.user_id, session.user.id))
        .where(eq(favorites.skill_id, skill.id))
        .limit(1);
      isFavorited = !!favorite;
    }

    return Response.json({
      skill,
      reviews: skillReviews,
      isFavorited,
      ratingSummary: {
        avgRating: ratingData?.avgRating || 0,
        ratingCount: ratingData?.ratingCount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching skill detail:", error);
    return Response.json(
      { error: "Failed to fetch skill details" },
      { status: 500 }
    );
  }
}
