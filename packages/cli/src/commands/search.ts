import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, ApiError } from '../lib/api-client.js';

interface SearchResult {
  slug: string;
  name: string;
  category: string;
  rating: number;
  description: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export const searchCommand = new Command('search')
  .description('Search for skills in the SkillX marketplace')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    const spinner = ora('Searching for skills...').start();

    try {
      const response = await apiRequest<SearchResponse>('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });

      spinner.stop();

      if (!response.results || response.results.length === 0) {
        console.log(chalk.yellow('\nNo skills found matching your query.'));
        console.log(chalk.dim('Try different search terms or browse all skills at https://skillx.sh'));
        return;
      }

      console.log(chalk.bold.green(`\n✓ Found ${response.total} skill(s)\n`));

      const colWidths = {
        name: 25,
        category: 15,
        rating: 8,
        description: 50,
      };

      console.log(
        chalk.bold(
          `${padRight('NAME', colWidths.name)} ${padRight('CATEGORY', colWidths.category)} ${padRight('RATING', colWidths.rating)} DESCRIPTION`
        )
      );
      console.log(chalk.dim('─'.repeat(100)));

      response.results.forEach((skill) => {
        const nameCol = chalk.cyan(padRight(skill.name, colWidths.name));
        const categoryCol = chalk.magenta(padRight(skill.category, colWidths.category));
        const ratingCol = chalk.yellow(padRight(`⭐ ${skill.rating.toFixed(1)}`, colWidths.rating));
        const descCol = truncate(skill.description, colWidths.description);

        console.log(`${nameCol} ${categoryCol} ${ratingCol} ${descCol}`);
      });

      console.log(chalk.dim(`\nUse ${chalk.cyan('skillx use <slug>')} to view and install a skill`));
    } catch (error) {
      spinner.stop();

      if (error instanceof ApiError) {
        console.error(chalk.red(`\n✗ API Error: ${error.message}`));
      } else if (error instanceof Error) {
        console.error(chalk.red(`\n✗ Network Error: ${error.message}`));
        console.error(chalk.dim('Check your internet connection or try again later.'));
      } else {
        console.error(chalk.red('\n✗ An unexpected error occurred'));
      }
      process.exit(1);
    }
  });

function padRight(str: string, width: number): string {
  return str.length >= width ? str.substring(0, width - 3) + '...' : str.padEnd(width);
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}
