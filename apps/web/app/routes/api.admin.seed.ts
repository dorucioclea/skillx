import type { ActionFunctionArgs } from "react-router";
import { getDb } from '~/lib/db';
import { skills } from '~/lib/db/schema';
import { indexSkill } from '~/lib/vectorize/index-skill';
import { recomputeSkillScores } from '~/lib/leaderboard/recompute-skill-scores';

interface SkillInput {
  name: string;
  slug: string;
  description: string;
  content: string;
  author: string;
  source_url?: string;
  category: string;
  install_command?: string;
  version?: string;
  is_paid?: boolean;
  price_cents?: number;
  avg_rating?: number;
  rating_count?: number;
  github_stars?: number;
  install_count?: number;
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Verify admin secret
  const adminSecret = request.headers.get('X-Admin-Secret');
  const env = context.cloudflare.env;

  if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse request body
    const skillsData: SkillInput[] = await request.json();

    if (!Array.isArray(skillsData)) {
      return Response.json({ error: 'Request body must be an array of skills' }, { status: 400 });
    }

    const db = getDb(env.DB);
    let skillCount = 0;
    let vectorCount = 0;

    // Process each skill
    for (const skillData of skillsData) {
      const skillId = crypto.randomUUID();
      const now = new Date();

      // Upsert skill into D1
      await db
        .insert(skills)
        .values({
          id: skillId,
          name: skillData.name,
          slug: skillData.slug,
          description: skillData.description,
          content: skillData.content,
          author: skillData.author,
          source_url: skillData.source_url || null,
          category: skillData.category,
          install_command: skillData.install_command || null,
          version: skillData.version || '1.0.0',
          is_paid: skillData.is_paid || false,
          price_cents: skillData.price_cents || 0,
          avg_rating: skillData.avg_rating || 0,
          rating_count: skillData.rating_count || 0,
          github_stars: skillData.github_stars || 0,
          install_count: skillData.install_count || 0,
          created_at: now,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: skills.slug,
          set: {
            name: skillData.name,
            description: skillData.description,
            content: skillData.content,
            author: skillData.author,
            source_url: skillData.source_url || null,
            category: skillData.category,
            install_command: skillData.install_command || null,
            version: skillData.version || '1.0.0',
            is_paid: skillData.is_paid || false,
            price_cents: skillData.price_cents || 0,
            avg_rating: skillData.avg_rating || 0,
            rating_count: skillData.rating_count || 0,
            github_stars: skillData.github_stars || 0,
            install_count: skillData.install_count || 0,
            updated_at: now,
          },
        });

      skillCount++;

      // Index skill in Vectorize (skip if not available locally)
      try {
        const vectors = await indexSkill(env.VECTORIZE, env.AI, {
          id: skillId,
          name: skillData.name,
          description: skillData.description,
          content: skillData.content,
          category: skillData.category,
          is_paid: skillData.is_paid || false,
          avg_rating: skillData.avg_rating || 0,
        });
        vectorCount += vectors;
      } catch (vecError) {
        console.warn(`Vectorize skipped for ${skillData.slug}:`, vecError instanceof Error ? vecError.message : vecError);
      }
    }

    // Backfill leaderboard scores for all skills
    const allSkills = await db.select({ id: skills.id }).from(skills);
    for (const s of allSkills) {
      await recomputeSkillScores(db, s.id);
    }

    return Response.json({
      skills: skillCount,
      vectors: vectorCount,
      scoresRecomputed: allSkills.length,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return Response.json(
      { error: 'Failed to seed skills', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
