/**
 * POST /api/skills/register — Auto-register a GitHub repo as a skill.
 * Fetches repo metadata + content from GitHub, creates skill in D1, indexes in Vectorize.
 * If skill already exists (by slug), returns existing skill without re-creating.
 */

import type { ActionFunctionArgs } from "react-router";
import { getDb } from "~/lib/db";
import { skills } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { fetchGitHubSkill } from "~/lib/github/fetch-github-skill";
import { indexSkill } from "~/lib/vectorize/index-skill";

const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const body = (await request.json()) as { owner?: string; repo?: string };
    const { owner, repo } = body;

    if (!owner || !repo || !GITHUB_REPO_PATTERN.test(`${owner}/${repo}`)) {
      return Response.json(
        { error: "Valid owner and repo required (e.g. { owner: 'org', repo: 'name' })" },
        { status: 400 },
      );
    }

    const env = context.cloudflare.env as Env;
    const db = getDb(env.DB);
    const slug = `${owner}-${repo}`.toLowerCase();

    // Check if skill already exists
    const [existing] = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, slug))
      .limit(1);

    if (existing) {
      return Response.json({ skill: existing, created: false });
    }

    // Fetch from GitHub
    const ghSkill = await fetchGitHubSkill(owner, repo);

    // Insert into D1
    const skillId = crypto.randomUUID();
    const now = new Date();

    await db.insert(skills).values({
      id: skillId,
      name: ghSkill.name,
      slug: ghSkill.slug,
      description: ghSkill.description,
      content: ghSkill.content,
      author: ghSkill.author,
      source_url: ghSkill.source_url,
      category: ghSkill.category,
      install_command: ghSkill.install_command,
      version: "1.0.0",
      is_paid: false,
      price_cents: 0,
      avg_rating: 0,
      rating_count: 0,
      github_stars: ghSkill.github_stars,
      install_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Index in Vectorize (non-blocking — skill is usable even if indexing fails)
    let vectorCount = 0;
    try {
      vectorCount = await indexSkill(env.VECTORIZE, env.AI, {
        id: skillId,
        name: ghSkill.name,
        description: ghSkill.description,
        content: ghSkill.content,
        category: ghSkill.category,
        is_paid: false,
        avg_rating: 0,
      });
    } catch (vecError) {
      console.warn(
        `Vectorize indexing failed for ${slug}:`,
        vecError instanceof Error ? vecError.message : vecError,
      );
    }

    // Re-fetch the inserted skill to return complete data
    const [created] = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, slug))
      .limit(1);

    return Response.json({
      skill: created,
      created: true,
      vectors: vectorCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Surface GitHub-specific errors with appropriate status codes
    if (message.includes("not found")) {
      return Response.json({ error: message }, { status: 404 });
    }
    if (message.includes("rate limit")) {
      return Response.json({ error: message }, { status: 429 });
    }

    console.error("Skill register error:", error);
    return Response.json(
      { error: "Failed to register skill", details: message },
      { status: 500 },
    );
  }
}
