import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, ApiError } from '../lib/api-client.js';
import { getApiKey, getBaseUrl, getDeviceId } from '../utils/config-store.js';
import { searchSkills } from '../lib/search-api.js';

interface SkillDetails {
  slug: string;
  name: string;
  description: string;
  category: string;
  avg_rating: number | null;
  install_command?: string;
  content: string;
}

interface RegisterResponse {
  skill: SkillDetails;
  created: boolean;
}

/** Detect org/repo GitHub format and return [owner, repo] or null */
function parseGitHubSlug(slug: string): [string, string] | null {
  const match = slug.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  return match ? [match[1], match[2]] : null;
}

/** Convert org/repo to API-safe slug: org-repo */
function toApiSlug(owner: string, repo: string): string {
  return `${owner}-${repo}`.toLowerCase();
}

/** Fetch and display a skill by slug. Exported for use by search --use */
export async function useSkillBySlug(
  slugArg: string,
  options: { raw: boolean }
): Promise<void> {
  const spinner = ora(`Fetching skill: ${slugArg}...`).start();
  const ghParts = parseGitHubSlug(slugArg);
  const apiSlug = ghParts ? toApiSlug(ghParts[0], ghParts[1]) : slugArg;

  let skill: SkillDetails;
  try {
    const res = await apiRequest<{ skill: SkillDetails }>(`/api/skills/${apiSlug}`);
    skill = res.skill;
  } catch (fetchErr) {
    // On 404 + GitHub org/repo format → try bare repo name, then auto-register
    if (fetchErr instanceof ApiError && fetchErr.status === 404 && ghParts) {
      try {
        // Fallback: try bare repo name (handles skills with non-prefixed slugs)
        const bareRes = await apiRequest<{ skill: SkillDetails }>(`/api/skills/${ghParts[1].toLowerCase()}`);
        skill = bareRes.skill;
      } catch (bareErr) {
        // Both slugs failed → auto-register from GitHub
        spinner.text = `Skill not found. Registering from GitHub: ${slugArg}...`;
        const res = await apiRequest<RegisterResponse>('/api/skills/register', {
          method: 'POST',
          body: JSON.stringify({ owner: ghParts[0], repo: ghParts[1] }),
        });
        skill = res.skill;
        if (res.created) {
          spinner.succeed(`Registered new skill from GitHub: ${slugArg}`);
        }
      }
    } else {
      spinner.stop();
      throw fetchErr;
    }
  }

  spinner.stop();

  // Fire-and-forget install tracking (silent failure)
  const installHeaders: Record<string, string> = {
    'X-Device-Id': getDeviceId(),
  };
  const apiKey = getApiKey();
  if (apiKey) {
    installHeaders['Authorization'] = `Bearer ${apiKey}`;
  }
  fetch(`${getBaseUrl()}/api/skills/${skill.slug}/install`, {
    method: 'POST',
    headers: installHeaders,
  }).catch(() => {});

  if (options.raw) {
    console.log(skill.content);
    return;
  }

  const rating = skill.avg_rating ?? 0;
  console.log(chalk.bold.green(`\n✓ Skill: ${skill.name}\n`));
  console.log(chalk.dim('─'.repeat(80)));
  console.log(chalk.bold('Description:'));
  console.log(skill.description);
  console.log();

  console.log(chalk.bold('Category:'), chalk.magenta(skill.category));
  console.log(chalk.bold('Rating:'), chalk.yellow(`⭐ ${rating.toFixed(1)}`));
  console.log();

  if (skill.install_command) {
    console.log(chalk.bold.cyan('Install Command:'));
    console.log(chalk.bgBlack.white(` ${skill.install_command} `));
    console.log();
  }

  console.log(chalk.bold('Content Preview:'));
  console.log(chalk.dim('─'.repeat(80)));
  const preview = skill.content.split('\n').slice(0, 30).join('\n');
  console.log(preview);

  if (skill.content.split('\n').length > 30) {
    console.log(chalk.dim('\n... (content truncated)'));
  }

  console.log(chalk.dim('\n' + '─'.repeat(80)));
  console.log(chalk.dim(`\nUse ${chalk.cyan(`skillx use ${slugArg} --raw`)} to output full content`));
  console.log(chalk.dim(`View online at: ${chalk.underline(`https://skillx.sh/skills/${skill.slug}`)}`));
}

/** Search for a keyword and use the top result */
async function searchAndUse(query: string, raw: boolean): Promise<void> {
  const spinner = ora(`Searching for "${query}"...`).start();
  const results = await searchSkills(query);
  spinner.stop();

  if (results.length === 0) {
    console.log(chalk.yellow('\nNo skills found matching your query.'));
    console.log(chalk.dim('Try different search terms or browse all skills at https://skillx.sh'));
    return;
  }

  const top = results[0];
  console.log(chalk.dim(`Top result for "${query}": ${chalk.cyan(`${top.author}/${top.name}`)}\n`));
  await useSkillBySlug(`${top.author}/${top.name}`, { raw });
}

export const useCommand = new Command('use')
  .description('Use a skill by slug, org/repo, or keyword search')
  .argument('<identifier>', 'Skill slug, org/repo, or search keywords')
  .option('-r, --raw', 'Output raw content only (for piping)')
  .option('-s, --search', 'Force search mode')
  .action(async (identifier: string, options: { raw?: boolean; search?: boolean }) => {
    const raw = options.raw ?? false;

    try {
      // Explicit --search flag or multi-word query → search mode
      if (options.search || identifier.includes(' ')) {
        await searchAndUse(identifier, raw);
        return;
      }

      // org/repo or slug → direct lookup (with auto-register for GitHub repos)
      await useSkillBySlug(identifier, { raw });
    } catch (error) {
      // On 404 for single-word slugs → fallback to search
      if (error instanceof ApiError && error.status === 404 && !parseGitHubSlug(identifier)) {
        try {
          console.log(chalk.dim(`Skill "${identifier}" not found, searching...`));
          await searchAndUse(identifier, raw);
          return;
        } catch {
          // Search also failed — fall through to error display
        }
      }

      if (error instanceof ApiError) {
        if (error.status === 404) {
          console.error(chalk.red(`\n✗ Skill not found: ${identifier}`));
          if (parseGitHubSlug(identifier)) {
            console.error(chalk.dim(`GitHub repo ${identifier} may not exist or is private.`));
          }
        } else if (error.status === 429) {
          console.error(chalk.red(`\n✗ Rate limited. Try again later.`));
        } else {
          console.error(chalk.red(`\n✗ API Error: ${error.message}`));
        }
      } else if (error instanceof Error) {
        console.error(chalk.red(`\n✗ Network Error: ${error.message}`));
        console.error(chalk.dim('Check your internet connection or try again later.'));
      } else {
        console.error(chalk.red('\n✗ An unexpected error occurred'));
      }
      process.exit(1);
    }
  });
