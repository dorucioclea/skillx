import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, ApiError } from '../lib/api-client.js';
import { getApiKey, getBaseUrl, getDeviceId } from '../utils/config-store.js';

interface SkillDetails {
  slug: string;
  name: string;
  description: string;
  category: string;
  rating: number;
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

export const useCommand = new Command('use')
  .description('View and use a skill from SkillX marketplace')
  .argument('<slug>', 'Skill slug identifier')
  .option('-r, --raw', 'Output raw content only (for piping)')
  .action(async (slugArg: string, options: { raw?: boolean }) => {
    const spinner = ora(`Fetching skill: ${slugArg}...`).start();
    const ghParts = parseGitHubSlug(slugArg);
    const apiSlug = ghParts ? toApiSlug(ghParts[0], ghParts[1]) : slugArg;

    try {

      let skill: SkillDetails;
      try {
        skill = await apiRequest<SkillDetails>(`/api/skills/${apiSlug}`);
      } catch (fetchErr) {
        // On 404 + GitHub org/repo format → auto-register from GitHub
        if (fetchErr instanceof ApiError && fetchErr.status === 404 && ghParts) {
          spinner.text = `Skill not found. Registering from GitHub: ${slugArg}...`;
          const res = await apiRequest<RegisterResponse>('/api/skills/register', {
            method: 'POST',
            body: JSON.stringify({ owner: ghParts[0], repo: ghParts[1] }),
          });
          skill = res.skill;
          if (res.created) {
            spinner.succeed(`Registered new skill from GitHub: ${slugArg}`);
          }
        } else {
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

      console.log(chalk.bold.green(`\n✓ Skill: ${skill.name}\n`));
      console.log(chalk.dim('─'.repeat(80)));
      console.log(chalk.bold('Description:'));
      console.log(skill.description);
      console.log();

      console.log(chalk.bold('Category:'), chalk.magenta(skill.category));
      console.log(chalk.bold('Rating:'), chalk.yellow(`⭐ ${skill.rating.toFixed(1)}`));
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

      console.log(chalk.dim('\n─'.repeat(80)));
      console.log(chalk.dim(`\nUse ${chalk.cyan(`skillx use ${slugArg} --raw`)} to output full content`));
      console.log(chalk.dim(`View online at: ${chalk.underline(`https://skillx.sh/skills/${skill.slug}`)}`));
    } catch (error) {
      spinner.stop();

      if (error instanceof ApiError) {
        if (error.status === 404) {
          console.error(chalk.red(`\n✗ Skill not found: ${slugArg}`));
          if (ghParts) {
            console.error(chalk.dim(`GitHub repo ${slugArg} may not exist or is private.`));
          }
          console.error(chalk.dim(`Search for skills with: ${chalk.cyan('skillx search <query>')}`));
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
