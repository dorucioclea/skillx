import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { PageContainer } from "../components/layout/page-container";
import { RatingBadge } from "../components/rating-badge";
import { CommandBox } from "../components/command-box";
import { StarRating } from "../components/star-rating";
import { FavoriteButton } from "../components/favorite-button";
import { ReviewForm } from "../components/review-form";
import { ReviewList } from "../components/review-list";
import { getDb } from "~/lib/db";
import { skills, ratings, reviews, favorites } from "~/lib/db/schema";
import { eq, desc, count, avg } from "drizzle-orm";
import { getSession } from "~/lib/auth/session-helpers";
import { useState } from "react";
import { useFetcher } from "react-router";

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Skill not found", { status: 404 });
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
    throw new Response("Skill not found", { status: 404 });
  }

  // Fetch reviews
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

  // Check authentication and user data
  const session = await getSession(request, env);
  let isFavorited = false;
  let userRating = null;

  if (session?.user?.id) {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(eq(favorites.user_id, session.user.id))
      .where(eq(favorites.skill_id, skill.id))
      .limit(1);
    isFavorited = !!favorite;

    const [rating] = await db
      .select()
      .from(ratings)
      .where(eq(ratings.user_id, session.user.id))
      .where(eq(ratings.skill_id, skill.id))
      .limit(1);
    userRating = rating?.score || null;
  }

  return {
    skill,
    reviews: skillReviews,
    isFavorited,
    userRating,
    isAuthenticated: !!session?.user?.id,
    ratingSummary: {
      avgRating: Number(ratingData?.avgRating || 0),
      ratingCount: Number(ratingData?.ratingCount || 0),
    },
  };
}

export default function SkillDetail() {
  const data = useLoaderData<typeof loader>();
  const [localRating, setLocalRating] = useState(data.userRating || 0);
  const [localFavorited, setLocalFavorited] = useState(data.isFavorited);
  const rateFetcher = useFetcher();

  const handleRatingChange = (score: number) => {
    setLocalRating(score);
    rateFetcher.submit(
      { score },
      {
        method: "post",
        action: `/api/skills/${data.skill.slug}/rate`,
        encType: "application/json",
      }
    );
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-mono text-3xl font-bold">{data.skill.name}</h1>
            <p className="mt-1 text-sm text-sx-fg-muted">by {data.skill.author}</p>
          </div>
          <div className="flex items-center gap-3">
            <RatingBadge score={data.ratingSummary.avgRating} />
            {data.isAuthenticated && (
              <FavoriteButton
                skillSlug={data.skill.slug}
                isFavorited={localFavorited}
                onToggle={setLocalFavorited}
              />
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold">Description</h2>
        <p className="text-sx-fg-muted">{data.skill.description}</p>
      </div>

      {/* Category Badge */}
      <div className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold">Category</h2>
        <span className="inline-block rounded-full bg-phase-devops-bg px-3 py-1 text-sm font-medium text-phase-devops">
          {data.skill.category}
        </span>
      </div>

      {/* Install Command */}
      <div className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold">Installation</h2>
        <CommandBox command={data.skill.install_command || `npx skillx install ${data.skill.slug}`} />
      </div>

      {/* User Rating (if authenticated) */}
      {data.isAuthenticated && (
        <div className="mb-8">
          <h2 className="mb-3 font-mono text-lg font-semibold">Your Rating</h2>
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-4">
            <StarRating value={localRating} onChange={handleRatingChange} />
          </div>
        </div>
      )}

      {/* Aggregate Rating */}
      <div className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold">Community Rating</h2>
        <div className="flex items-center gap-4 rounded-lg border border-sx-border bg-sx-bg-elevated p-4">
          <RatingBadge score={data.ratingSummary.avgRating} />
          <span className="text-sm text-sx-fg-muted">
            Based on {data.ratingSummary.ratingCount} rating{data.ratingSummary.ratingCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold">Reviews</h2>
        {data.isAuthenticated && (
          <div className="mb-6">
            <ReviewForm skillSlug={data.skill.slug} />
          </div>
        )}
        <ReviewList reviews={data.reviews} />
      </div>
    </PageContainer>
  );
}
