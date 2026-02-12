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
```

### `skillx find <query>`

Interactive search — browse results and select a skill to view details.

```bash
skillx find "testing"
```

### `skillx use <slug>`

View a skill's details and content. Supports GitHub `org/repo` format — if the skill isn't registered yet, it auto-registers from the repo.

```bash
skillx use my-skill
skillx use owner/repo          # auto-registers from GitHub
skillx use my-skill --raw      # output raw content (for piping)
```

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
