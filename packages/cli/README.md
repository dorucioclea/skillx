# skillx-sh

The Only Skill That Your AI Agent Needs.

CLI for the [SkillX.sh](https://skillx.sh) marketplace — search, discover, and use AI agent skills from your terminal.

## Install

```bash
npm install -g skillx-sh
```

Or run directly with npx:

```bash
npx skillx-sh search "code review"
```

## Commands

### `skillx search <query>`

Search the SkillX marketplace for skills.

```bash
skillx search "code review"
skillx search "database migration"
skillx search "ui ux" --use     # auto-pick top result and show details
```

### `skillx find <query>`

Interactive search — browse results and select a skill to view details.

```bash
skillx find "testing"
```

### `skillx use <identifier>`

Smart skill lookup — auto-detects whether you're using a slug, GitHub repo, or keyword search.

```bash
skillx use owner/repo          # direct lookup, auto-registers from GitHub if new
skillx use "ui ux design"      # keyword search, auto-picks top result
skillx use my-skill            # exact slug lookup (fallback to search on 404)
skillx use my-skill --raw      # output raw content (for piping)
```

**How it works:**
- `org/repo` format → fetches directly, auto-registers + indexes in Vectorize if not in DB
- Multi-word query → searches and uses the top result
- Single-word slug → tries direct lookup, falls back to search if not found

### `skillx report <slug> <outcome>`

Report skill usage outcome (requires API key).

```bash
skillx report my-skill success
skillx report my-skill failure --model claude-sonnet-4 --duration 5000
```

### `skillx config`

Manage CLI configuration.

```bash
skillx config set-key          # set your API key
skillx config set-url <url>    # set custom API URL
skillx config show             # show current config
```

## Configuration

**API Key** — get yours at [skillx.sh/settings](https://skillx.sh/settings), then:

```bash
skillx config set-key
```

Or set via environment variable:

```bash
export SKILLX_API_KEY=your-key-here
```

## Links

- Website: [skillx.sh](https://skillx.sh)
- GitHub: [github.com/nextlevelbuilder/skillx](https://github.com/nextlevelbuilder/skillx)

## License

MIT
