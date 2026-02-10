/**
 * Hybrid search orchestrator combining FTS5 keyword search and vector semantic search
 * Uses RRF fusion and quality boost scoring for optimal results
 */

import { eq, inArray, and } from 'drizzle-orm';
import type { Database } from '~/lib/db';
import { skills, favorites } from '~/lib/db/schema';
import { fts5Search } from './fts5-search';
import { vectorSearch } from './vector-search';
import { reciprocalRankFusion } from './rrf-fusion';
import { applyBoostScoring, type SkillStats } from './boost-scoring';

export interface SearchFilters {
  category?: string;
  is_paid?: boolean;
}

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  content: string;
  author: string;
  source_url: string | null;
  category: string;
  install_command: string | null;
  version: string | null;
  is_paid: boolean | null;
  price_cents: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  install_count: number | null;
  created_at: Date | null;
  updated_at: Date | null;
  final_score: number;
  rrf_score: number;
  semantic_rank: number | null;
  keyword_rank: number | null;
}

/**
 * Fetch skill stats for boost scoring
 */
async function fetchSkillStats(
  db: Database,
  skillIds: string[],
  userId?: string
): Promise<Map<string, SkillStats>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  // Fetch basic skill data (avg_rating, install_count)
  const skillData = await db
    .select({
      id: skills.id,
      avg_rating: skills.avg_rating,
      install_count: skills.install_count,
    })
    .from(skills)
    .where(inArray(skills.id, skillIds));

  // Fetch favorites if user is authenticated
  let userFavorites = new Set<string>();
  if (userId) {
    const favResults = await db
      .select({ skill_id: favorites.skill_id })
      .from(favorites)
      .where(
        and(
          eq(favorites.user_id, userId),
          inArray(favorites.skill_id, skillIds)
        )
      );
    userFavorites = new Set(favResults.map((f) => f.skill_id));
  }

  // Build stats map
  const statsMap = new Map<string, SkillStats>();
  for (const skill of skillData) {
    statsMap.set(skill.id, {
      avg_rating: skill.avg_rating || 0,
      usage_count: skill.install_count || 0,
      is_favorited: userFavorites.has(skill.id),
    });
  }

  return statsMap;
}

/**
 * Fetch full skill data for final results
 */
async function fetchSkills(
  db: Database,
  skillIds: string[]
): Promise<Map<string, SearchResult>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const skillData = await db
    .select()
    .from(skills)
    .where(inArray(skills.id, skillIds));

  const skillMap = new Map<string, SearchResult>();
  for (const skill of skillData) {
    skillMap.set(skill.id, {
      ...skill,
      final_score: 0, // Will be set by caller
      rrf_score: 0,
      semantic_rank: null,
      keyword_rank: null,
    });
  }

  return skillMap;
}

/**
 * Main hybrid search function
 * Combines FTS5 and vector search, applies RRF fusion and quality boost
 *
 * @param db - Drizzle database instance
 * @param d1 - D1 database (for FTS5 raw queries)
 * @param vectorize - Vectorize index binding
 * @param ai - Workers AI binding
 * @param query - Search query string
 * @param filters - Optional category and payment filters
 * @param userId - Optional user ID for personalization
 * @param limit - Maximum results to return (default: 20)
 * @returns Array of search results with full skill data and scores
 */
export async function hybridSearch(
  db: Database,
  d1: D1Database,
  vectorize: VectorizeIndex,
  ai: Ai,
  query: string,
  filters?: SearchFilters,
  userId?: string,
  limit = 20
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    // Run both search methods in parallel
    const [fts5Results, vectorResults] = await Promise.all([
      fts5Search(d1, query, limit),
      vectorSearch(vectorize, ai, query, limit),
    ]);

    // If both searches return nothing, return empty
    if (fts5Results.length === 0 && vectorResults.length === 0) {
      return [];
    }

    // Apply RRF fusion
    const fusedResults = reciprocalRankFusion(
      vectorResults.map((r) => ({ skill_id: r.skill_id, rank: r.rank })),
      fts5Results.map((r) => ({ skill_id: r.skill_id, rank: r.rank }))
    );

    // Get skill IDs for top results (before boost, to limit data fetching)
    const topSkillIds = fusedResults.slice(0, limit * 2).map((r) => r.skill_id);

    // Fetch stats for boost scoring
    const statsMap = await fetchSkillStats(db, topSkillIds, userId);

    // Apply quality boost
    const boostedResults = applyBoostScoring(fusedResults, statsMap);

    // Take top N after boosting
    const finalResultIds = boostedResults.slice(0, limit).map((r) => r.skill_id);

    // Fetch full skill data
    const skillsMap = await fetchSkills(db, finalResultIds);

    // Combine skill data with scores, maintaining boost order
    const finalResults: SearchResult[] = [];
    for (const boosted of boostedResults.slice(0, limit)) {
      const skill = skillsMap.get(boosted.skill_id);
      if (skill) {
        finalResults.push({
          ...skill,
          final_score: boosted.final_score,
          rrf_score: boosted.rrf_score,
          semantic_rank: boosted.semantic_rank,
          keyword_rank: boosted.keyword_rank,
        });
      }
    }

    // Apply filters if specified
    let filteredResults = finalResults;
    if (filters?.category) {
      filteredResults = filteredResults.filter(
        (r) => r.category === filters.category
      );
    }
    if (filters?.is_paid !== undefined) {
      filteredResults = filteredResults.filter(
        (r) => r.is_paid === filters.is_paid
      );
    }

    return filteredResults;
  } catch (error) {
    console.error('Hybrid search error:', error);
    // Fallback to FTS5-only search on error
    try {
      const fts5Results = await fts5Search(d1, query, limit);
      const skillIds = fts5Results.map((r) => r.skill_id);
      const skillsMap = await fetchSkills(db, skillIds);

      return fts5Results
        .map((r) => {
          const skill = skillsMap.get(r.skill_id);
          if (!skill) return null;
          return {
            ...skill,
            final_score: 1 / (60 + r.rank), // Simple RRF-style score
            rrf_score: 0,
            semantic_rank: null,
            keyword_rank: r.rank,
          };
        })
        .filter((r): r is SearchResult => r !== null);
    } catch (fallbackError) {
      console.error('FTS5 fallback search error:', fallbackError);
      return [];
    }
  }
}
