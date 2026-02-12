/**
 * Pure scoring functions for leaderboard composite ranking.
 * Bayesian average, composite score (6 weighted signals), trending velocity.
 */

import { logNormalize, recencyScore } from "~/lib/scoring-utils";

/** Leaderboard composite weights — must sum to 1.0 */
const WEIGHTS = {
  bayesianRating: 0.35,
  installs: 0.25,
  stars: 0.15,
  success: 0.10,
  recency: 0.10,
  favorites: 0.05,
} as const;

/** Default confidence threshold for Bayesian average */
const DEFAULT_CONFIDENCE = 10;

/**
 * Bayesian average rating — pulls low-sample skills toward global mean.
 * Formula: (C * m + avg * n) / (C + n)
 */
export function computeBayesianRating(
  avgRating: number,
  ratingCount: number,
  globalAvgRating: number,
  confidence = DEFAULT_CONFIDENCE,
): number {
  return (confidence * globalAvgRating + avgRating * ratingCount) /
    (confidence + ratingCount);
}

export interface CompositeInputs {
  bayesianRating: number;
  installCount: number;
  githubStars: number;
  successRate: number;
  updatedAt: Date | null;
  favoriteCount: number;
  maxInstalls: number;
  maxStars: number;
  maxFavorites: number;
}

/**
 * Composite leaderboard score combining 6 normalized signals.
 * Returns value in 0-1 range.
 */
export function computeCompositeScore(inputs: CompositeInputs): number {
  const normalizedRating = inputs.bayesianRating / 10; // scale is 0-10
  const normalizedInstalls = logNormalize(inputs.installCount, inputs.maxInstalls);
  const normalizedStars = logNormalize(inputs.githubStars, inputs.maxStars);
  const normalizedFavorites = logNormalize(inputs.favoriteCount, inputs.maxFavorites);
  const normalizedRecency = recencyScore(inputs.updatedAt);

  return (
    normalizedRating * WEIGHTS.bayesianRating +
    normalizedInstalls * WEIGHTS.installs +
    normalizedStars * WEIGHTS.stars +
    inputs.successRate * WEIGHTS.success +
    normalizedRecency * WEIGHTS.recency +
    normalizedFavorites * WEIGHTS.favorites
  );
}

/**
 * Trending score based on 7-day activity velocity.
 * Ratings weighted 2x over usage events.
 */
export function computeTrendingScore(
  recentRatings7d: number,
  recentUsage7d: number,
  maxTrendingRaw: number,
): number {
  const raw = recentRatings7d * 2 + recentUsage7d;
  return logNormalize(raw, maxTrendingRaw);
}
