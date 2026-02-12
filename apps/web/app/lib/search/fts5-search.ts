/**
 * FTS5 (Full-Text Search) module for keyword-based search.
 * Uses SQLite FTS5 virtual table with weighted BM25 ranking (name 10x, desc 5x, content 1x).
 * Supports pre-filtering by category/is_paid and prefix matching for autocomplete.
 */

import { expandAliases } from './query-aliases';

export interface FTS5Result {
  skill_id: string;
  bm25_score: number;
  rank: number;
}

export interface FTS5Filters {
  category?: string;
  is_paid?: boolean;
}

/** Convert query terms to FTS5 prefix-match format.
 *  Preserves OR/AND operators and parentheses from alias expansion.
 *  Example: "deploy tool" → "deploy* tool*"
 *  Example: "(kubernetes OR k8s) deploy" → "(kubernetes* OR k8s*) deploy*" */
function toPrefixQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      // Don't add * to FTS5 boolean operators
      if (token === 'OR' || token === 'AND' || token === 'NOT') return token;
      // Handle opening paren: "(term" → "(term*"
      if (token.startsWith('(')) return `(${token.slice(1)}*`;
      // Handle closing paren: "term)" → "term*)"
      if (token.endsWith(')')) return `${token.slice(0, -1)}*)`;
      return `${token}*`;
    })
    .join(' ');
}

/**
 * Search skills using FTS5 full-text search with weighted BM25 ranking.
 * Supports optional category/is_paid pre-filters and prefix matching.
 *
 * @param db - D1 Database instance
 * @param query - Search query string
 * @param limit - Maximum number of results to return (default: 20)
 * @param filters - Optional category and is_paid filters pushed to SQL WHERE
 * @returns Array of FTS5 search results with BM25 scores
 */
export async function fts5Search(
  db: D1Database,
  query: string,
  limit = 20,
  filters?: FTS5Filters
): Promise<FTS5Result[]> {
  // Sanitize: strip FTS5 special characters to prevent injection
  const sanitized = query.replace(/[^\w\s]/g, '').trim();

  if (!sanitized) {
    return [];
  }

  try {
    // Expand aliases (k8s→kubernetes, etc.) then add prefix wildcards
    const aliasExpanded = expandAliases(sanitized);
    const matchQuery = toPrefixQuery(aliasExpanded);

    // Build dynamic SQL with optional pre-filters
    let sql = `
      SELECT s.id as skill_id, bm25(skills_fts, 10.0, 5.0, 1.0) as bm25_score
      FROM skills_fts
      JOIN skills s ON skills_fts.rowid = s.rowid
      WHERE skills_fts MATCH ?1
    `;
    const params: (string | number)[] = [matchQuery];
    let paramIdx = 2;

    if (filters?.category) {
      sql += ` AND s.category = ?${paramIdx}`;
      params.push(filters.category);
      paramIdx++;
    }

    if (filters?.is_paid !== undefined) {
      sql += ` AND s.is_paid = ?${paramIdx}`;
      params.push(filters.is_paid ? 1 : 0);
      paramIdx++;
    }

    sql += ` ORDER BY bm25(skills_fts, 10.0, 5.0, 1.0) LIMIT ?${paramIdx}`;
    params.push(limit);

    const stmt = db.prepare(sql);
    const results = await stmt
      .bind(...params)
      .all<{ skill_id: string; bm25_score: number }>();

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
