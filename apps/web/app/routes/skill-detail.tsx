import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { PageContainer } from "../components/layout/page-container";
import { CommandBox } from "../components/command-box";
import { StarRating } from "../components/star-rating";
import { FavoriteButton } from "../components/favorite-button";
import { ReviewForm } from "../components/review-form";
import { ReviewList } from "../components/review-list";
import { SkillDetailSidebar } from "../components/skill-detail-sidebar";
import { SkillContentRenderer } from "../components/skill-content-renderer";
import { getDb } from "~/lib/db";
import { getSession } from "~/lib/auth/session-helpers";
import {
  fetchSkillBySlug,
  fetchSkillReviews,
  fetchRatingSummary,
  fetchRatingBreakdown,
  fetchFavoriteCount,
  fetchUsageStats,
  fetchUserSkillData,
} from "~/lib/db/skill-detail-queries";
import { useState } from "react";
import { useFetcher } from "react-router";
import { FileText } from "lucide-react";

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw new Response("Skill not found", { status: 404 });

  const env = context.cloudflare.env as Env;
  const db = getDb(env.DB);

  const skill = await fetchSkillBySlug(db, slug);
  if (!skill) throw new Response("Skill not found", { status: 404 });

  // Run all independent queries in parallel
  const [skillReviews, ratingSummary, ratingBreakdown, favoriteCount, usage, session] =
    await Promise.all([
      fetchSkillReviews(db, skill.id),
      fetchRatingSummary(db, skill.id),
      fetchRatingBreakdown(db, skill.id),
      fetchFavoriteCount(db, skill.id),
      fetchUsageStats(db, skill.id),
      getSession(request, env),
    ]);

  // User-specific data (only if authenticated)
  const userData = session?.user?.id
    ? await fetchUserSkillData(db, session.user.id, skill.id)
    : { isFavorited: false, userRating: null };

  return {
    skill,
    reviews: skillReviews,
    ...userData,
    isAuthenticated: !!session?.user?.id,
    ratingSummary,
    ratingBreakdown,
    favoriteCount,
    usage,
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

  const installCmd = data.skill.install_command || `npx skillx install ${data.skill.slug}`;

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-sx-fg-muted">
        <Link to="/" className="transition-colors hover:text-sx-fg">skills</Link>
        <span>/</span>
        <span className="text-sx-fg-subtle">{data.skill.author}</span>
        <span>/</span>
        <span className="text-sx-fg">{data.skill.slug}</span>
      </nav>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:gap-16">
        {/* Main content */}
        <div className="min-w-0">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-sans text-4xl font-semibold tracking-tight">
                {data.skill.name}
              </h1>
              <p className="mt-1.5 text-sm text-sx-fg-muted">by {data.skill.author}</p>
            </div>
            {data.isAuthenticated && (
              <FavoriteButton
                skillSlug={data.skill.slug}
                isFavorited={localFavorited}
                onToggle={setLocalFavorited}
              />
            )}
          </div>

          {/* Install command card */}
          <div className="mb-8">
            <CommandBox command={installCmd} />
          </div>

          {/* SKILL.md label */}
          <div className="mb-4 flex items-center gap-2 text-xs text-sx-fg-subtle">
            <FileText size={14} />
            <span className="font-mono uppercase tracking-wider">SKILL.md</span>
          </div>

          {/* Separator */}
          <hr className="mb-8 border-sx-border" />

          {/* Description / Content (rendered as markdown) */}
          <div className="mb-10">
            {data.skill.content && data.skill.content !== data.skill.description ? (
              <SkillContentRenderer content={data.skill.content} />
            ) : (
              <p className="text-sx-fg-muted leading-relaxed">{data.skill.description}</p>
            )}
          </div>

          {/* User Rating */}
          {data.isAuthenticated && (
            <div className="mb-8">
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Your Rating</h2>
              <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-4">
                <StarRating value={localRating} onChange={handleRatingChange} />
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              Reviews
              <span className="ml-2 text-sm font-normal text-sx-fg-muted">
                ({data.reviews.length})
              </span>
            </h2>
            {data.isAuthenticated && (
              <div className="mb-6">
                <ReviewForm skillSlug={data.skill.slug} />
              </div>
            )}
            <ReviewList reviews={data.reviews} />
          </div>
        </div>

        {/* Sidebar */}
        <SkillDetailSidebar
          installs={data.skill.install_count ?? 0}
          avgRating={data.ratingSummary.avgRating}
          ratingCount={data.ratingSummary.ratingCount}
          humanRatingCount={data.ratingBreakdown.humanCount}
          agentRatingCount={data.ratingBreakdown.agentCount}
          successRate={data.usage.successRate}
          totalUsages={data.usage.totalUsages}
          sourceUrl={data.skill.source_url}
          category={data.skill.category}
          version={data.skill.version ?? "1.0.0"}
          createdAt={data.skill.created_at}
          favoriteCount={data.favoriteCount}
          modelBreakdown={data.usage.modelBreakdown}
        />
      </div>
    </PageContainer>
  );
}
