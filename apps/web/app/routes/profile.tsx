import type { Route } from "./+types/profile";
import { PageContainer } from "../components/layout/page-container";
import { SkillCard } from "../components/skill-card";
import { User } from "lucide-react";
import { getDb } from "~/lib/db";
import { favorites, skills } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "~/lib/auth/session-helpers";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);

  if (!session?.user) {
    return { user: null, favoriteSkills: [] };
  }

  const db = getDb(env.DB);
  const userFavorites = await db
    .select()
    .from(favorites)
    .innerJoin(skills, eq(favorites.skill_id, skills.id))
    .where(eq(favorites.user_id, session.user.id));

  return {
    user: session.user,
    favoriteSkills: userFavorites.map((f) => f.skills),
  };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, favoriteSkills } = loaderData;
  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-8 text-center">
            <User className="mx-auto mb-4 text-sx-fg-muted" size={48} />
            <h2 className="mb-2 font-mono text-xl font-bold">Login Required</h2>
            <p className="text-sx-fg-muted">
              Please log in to view your profile.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="font-mono text-3xl font-bold">Profile</h1>
        <p className="mt-2 text-sx-fg-muted">Your favorites and usage history.</p>
      </div>

      {/* Avatar & Name */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sx-accent-muted">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="h-full w-full rounded-full"
            />
          ) : (
            <User className="text-sx-accent" size={32} />
          )}
        </div>
        <div>
          <h2 className="font-mono text-xl font-semibold">
            {user?.name || "User Name"}
          </h2>
          <p className="text-sm text-sx-fg-muted">
            {user?.email || "user@example.com"}
          </p>
        </div>
      </div>

      {/* Favorites */}
      <div className="mb-8">
        <h2 className="mb-4 font-mono text-lg font-semibold">Favorites</h2>
        {favoriteSkills.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favoriteSkills.map((skill) => (
              <SkillCard
                key={skill.slug}
                slug={skill.slug}
                name={skill.name}
                author={skill.author}
                description={skill.description}
                category={skill.category}
                installs={skill.install_count || 0}
                rating={skill.avg_rating || 0}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-8 text-center">
            <p className="text-sx-fg-muted">No favorites yet.</p>
          </div>
        )}
      </div>

      {/* Usage History */}
      <div className="mb-8">
        <h2 className="mb-4 font-mono text-lg font-semibold">Usage History</h2>
        <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-8 text-center">
          <p className="text-sx-fg-muted">No usage history available.</p>
        </div>
      </div>
    </PageContainer>
  );
}
