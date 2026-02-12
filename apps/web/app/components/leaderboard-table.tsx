import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { RatingBadge } from "./rating-badge";
import { SignalBadge } from "./signal-badge";

export interface LeaderboardEntry {
  rank: number;
  slug: string;
  name: string;
  author: string;
  installs: number;
  rating: number;
  badges?: string[];
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-sx-border">
      <table className="w-full">
        <thead className="sticky top-0 bg-sx-bg-elevated">
          <tr className="border-b border-sx-border">
            <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Rank
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Skill
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Author
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Installs
            </th>
            <th className="px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Rating
            </th>
            <th className="px-4 py-3 text-right font-mono text-xs uppercase tracking-wide text-sx-fg-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.slug}
              className={`h-12 border-b border-sx-border transition-colors hover:bg-sx-bg-hover ${
                entry.rank <= 3 ? "bg-sx-bg-elevated" : "bg-sx-bg"
              }`}
            >
              <td className="px-4 py-3">
                <span
                  className={`font-mono text-sm font-bold ${
                    entry.rank === 1
                      ? "text-tier-s"
                      : entry.rank === 2
                        ? "text-tier-a"
                        : entry.rank === 3
                          ? "text-tier-b"
                          : "text-sx-fg-muted"
                  }`}
                >
                  #{entry.rank}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center">
                  <Link
                    to={`/skills/${entry.slug}`}
                    className="font-medium text-sx-fg hover:text-sx-accent"
                  >
                    {entry.name}
                  </Link>
                  {entry.badges?.map((b) => (
                    <SignalBadge key={b} type={b} />
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-sx-fg-muted">
                {entry.author}
              </td>
              <td className="px-4 py-3 font-mono text-sm text-sx-fg">
                {formatNumber(entry.installs)}
              </td>
              <td className="px-4 py-3">
                <RatingBadge score={entry.rating} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/skills/${entry.slug}`}
                  className="inline-flex items-center gap-1 text-sm text-sx-fg-muted hover:text-sx-fg"
                >
                  View
                  <ExternalLink size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
