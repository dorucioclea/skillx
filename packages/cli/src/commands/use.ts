import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, ApiError } from '../lib/api-client.js';

interface SkillDetails {
  slug: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  install_command?: string;
  content: string;
}

export const useCommand = new Command('use')
  .description('View and use a skill from SkillX marketplace')
  .argument('<slug>', 'Skill slug identifier')
  .option('-r, --raw', 'Output raw content only (for piping)')
  .action(async (slug: string, options: { raw?: boolean }) => {
    const spinner = ora(`Fetching skill: ${slug}...`).start();

    try {
      const skill = await apiRequest<SkillDetails>(`/api/skills/${slug}`);
      spinner.stop();

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
      console.log(chalk.dim(`\nUse ${chalk.cyan(`skillx use ${slug} --raw`)} to output full content`));
      console.log(chalk.dim(`View online at: ${chalk.underline(`https://skillx.sh/skills/${slug}`)}`));
    } catch (error) {
      spinner.stop();

      if (error instanceof ApiError) {
        if (error.status === 404) {
          console.error(chalk.red(`\n✗ Skill not found: ${slug}`));
          console.error(chalk.dim(`Search for skills with: ${chalk.cyan('skillx search <query>')}`));
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
