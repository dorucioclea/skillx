/**
 * FTS5 (Full-Text Search) module for keyword-based search
 * Uses SQLite FTS5 virtual table with BM25 ranking
 */

export interface FTS5Result {
  skill_id: string;
  bm25_score: number;
  rank: number;
}

/**
 * Search skills using FTS5 full-text search with BM25 ranking
 *
 * @param db - D1 Database instance
 * @param query - Search query string
 * @param limit - Maximum number of results to return (default: 20)
 * @returns Array of FTS5 search results with BM25 scores
 */
export async function fts5Search(
  db: D1Database,
  query: string,
  limit = 20
): Promise<FTS5Result[]> {
  // Sanitize query: strip FTS5 special characters to prevent injection
  const sanitized = query.replace(/[^\w\s]/g, '').trim();

  if (!sanitized) {
    return [];
  }

  try {
    // D1 raw query for FTS5 (Drizzle doesn't support FTS5 virtual tables directly)
    // Using bm25() ranking function for relevance scoring
    const stmt = db.prepare(`
      SELECT s.id as skill_id, bm25(skills_fts) as bm25_score
      FROM skills_fts
      JOIN skills s ON skills_fts.rowid = s.rowid
      WHERE skills_fts MATCH ?
      ORDER BY bm25(skills_fts)
      LIMIT ?
    `);

    const results = await stmt
      .bind(sanitized, limit)
      .all<{ skill_id: string; bm25_score: number }>();

    // Map results and add rank position
    return (results.results || []).map((r, i) => ({
      skill_id: r.skill_id,
      bm25_score: r.bm25_score,
      rank: i + 1,
    }));
  } catch (error) {
    console.error('FTS5 search error:', error);
    return [];
  }
}
