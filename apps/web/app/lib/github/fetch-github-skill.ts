/**
 * Fetch skill data from a public GitHub repository.
 * Tries SKILL.md → CLAUDE.md → README.md for content.
 * Uses GitHub REST API (unauthenticated — rate-limited to 60 req/hr/IP).
 */

export interface GitHubSkillData {
  name: string;
  slug: string;
  description: string;
  content: string;
  author: string;
  source_url: string;
  category: string;
  install_command: string;
  github_stars: number;
}

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  owner: { login: string };
  stargazers_count: number;
  topics: string[];
  html_url: string;
  default_branch: string;
}

/** Map GitHub topics to SkillX categories */
const TOPIC_CATEGORY_MAP: Record<string, string> = {
  "ai-agent": "agent",
  "ai-agents": "agent",
  "agent-skills": "agent",
  "claude": "agent",
  "llm": "agent",
  devops: "devops",
  deployment: "devops",
  "ci-cd": "devops",
  testing: "testing",
  security: "security",
  database: "database",
  frontend: "frontend",
  backend: "backend",
  api: "backend",
  documentation: "documentation",
  design: "design",
};

function inferCategory(topics: string[]): string {
  for (const topic of topics) {
    const category = TOPIC_CATEGORY_MAP[topic.toLowerCase()];
    if (category) return category;
  }
  return "general";
}

/** Content files to try, in priority order */
const CONTENT_FILES = ["SKILL.md", "CLAUDE.md", "README.md"];

/**
 * Fetch raw file content from GitHub repo's default branch.
 * Returns null if file doesn't exist (404).
 */
async function fetchRepoFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

/**
 * Fetch skill data from a public GitHub repo.
 * @throws Error if repo not found or not accessible.
 */
export async function fetchGitHubSkill(
  owner: string,
  repo: string,
): Promise<GitHubSkillData> {
  // Fetch repo metadata
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "SkillX/1.0" } },
  );

  if (repoRes.status === 404) {
    throw new Error(`GitHub repository ${owner}/${repo} not found`);
  }
  if (repoRes.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Try again later.");
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub API error: ${repoRes.status}`);
  }

  const repoData = (await repoRes.json()) as GitHubRepoResponse;

  // Fetch content: try SKILL.md → CLAUDE.md → README.md
  let content: string | null = null;
  for (const file of CONTENT_FILES) {
    content = await fetchRepoFile(owner, repo, repoData.default_branch, file);
    if (content) break;
  }

  if (!content) {
    // Fallback: use description as content
    content = repoData.description || `# ${repoData.name}\n\nNo skill documentation found.`;
  }

  const slug = `${owner}-${repo}`.toLowerCase();

  return {
    name: repoData.name,
    slug,
    description: repoData.description || `${owner}/${repo} skill`,
    content,
    author: repoData.owner.login,
    source_url: repoData.html_url,
    category: inferCategory(repoData.topics || []),
    install_command: `npx skillx-sh use ${owner}/${repo}`,
    github_stars: repoData.stargazers_count,
  };
}
