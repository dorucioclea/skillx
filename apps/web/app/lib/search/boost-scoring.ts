/**
 * Boost scoring module to enhance search results with quality signals
 * Combines RRF scores with ratings, usage stats, and user favorites
 */

import type { RRFResult } from './rrf-fusion';

export interface SkillStats {
  avg_rating: number;
  usage_count: number;
  is_favorited: boolean;
}

export interface BoostedResult {
  skill_id: string;
  final_score: number;
  rrf_score: number;
  rating_boost: number;
  usage_boost: number;
  favorite_boost: number;
  semantic_rank: number | null;
  keyword_rank: number | null;
}

/**
 * Apply quality boost to RRF scores
 * Formula: final = rrf * 0.6 + normalizedRating * 0.2 + normalizedUsage * 0.1 + favBoost * 0.1
 *
 * @param rrfResults - Results from RRF fusion
 * @param statsMap - Map of skill_id to quality stats
 * @returns Results with boosted scores, sorted by final_score descending
 */
export function applyBoostScoring(
  rrfResults: RRFResult[],
  statsMap: Map<string, SkillStats>
): BoostedResult[] {
  if (rrfResults.length === 0) {
    return [];
  }

  // Find max values for normalization
  const maxRrfScore = Math.max(...rrfResults.map((r) => r.rrf_score));
  const allStats = Array.from(statsMap.values());
  const maxRating = 10; // Rating scale is 0-10
  const maxUsage = Math.max(...allStats.map((s) => s.usage_count), 1);

  // Calculate boosted scores
  const boostedResults: BoostedResult[] = rrfResults.map((result) => {
    const stats = statsMap.get(result.skill_id) || {
      avg_rating: 0,
      usage_count: 0,
      is_favorited: false,
    };

    // Normalize each component to 0-1 range
    const normalizedRrf = maxRrfScore > 0 ? result.rrf_score / maxRrfScore : 0;
    const normalizedRating = stats.avg_rating / maxRating;
    const normalizedUsage = stats.usage_count / maxUsage;
    const favoriteBoost = stats.is_favorited ? 1.0 : 0;

    // Apply weighted formula
    const ratingBoost = normalizedRating * 0.2;
    const usageBoost = normalizedUsage * 0.1;
    const favBoost = favoriteBoost * 0.1;

    const finalScore = normalizedRrf * 0.6 + ratingBoost + usageBoost + favBoost;

    return {
      skill_id: result.skill_id,
      final_score: finalScore,
      rrf_score: result.rrf_score,
      rating_boost: ratingBoost,
      usage_boost: usageBoost,
      favorite_boost: favBoost,
      semantic_rank: result.semantic_rank,
      keyword_rank: result.keyword_rank,
    };
  });

  // Sort by final score descending
  return boostedResults.sort((a, b) => b.final_score - a.final_score);
}
