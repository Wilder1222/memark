# memark

Local memory system for Claude CLI and Codex CLI.

Memark stores long-term memory in plain Markdown files and is designed to run automatically through Claude CLI / Codex CLI hooks.

## Install

```bash
# Project-level install (recommended)
npx github:Wilder1222/memark
```

What this does automatically:
- Installs runtime files to `./.memark/`
- Creates `./memory/` (if missing)
- Creates or updates `./CLAUDE.md` with memark prompt block
- Configures Claude Code hooks in `.claude/settings.json`

After install, every Claude session will automatically:
1. **Session start** — rebuild memory index and inject it into Claude's context
2. **Session end** — run maintenance (decay, archive) on a threshold schedule

## What Gets Created

```text
memory/
  MEMORY.md
  AGENT-INSTRUCTIONS.md
  MAINTENANCE.md
  TEMPLATE.md
  user/
  project/
  patterns/
  feedback/
  archive/
```

Example files in `templates/` are references and are not installed into user memory by default.

## Memory File Format

Each memory is a Markdown file with YAML frontmatter:

```markdown
---
name: User prefers concise responses
type: feedback
tags: [communication, style]
confidence: 0.9
created: 2026-03-25
last_accessed: 2026-03-25
access_count: 1
ttl: null
related: []
---

User wants direct answers without preamble or trailing summaries.
```

Validation rules:

- `type`: `user | project | pattern | feedback`
- `confidence`: number in [0.0, 1.0]
- date fields: `YYYY-MM-DD`
- `ttl`: `null` or positive integer

## Commands Reference

```bash
# one-time project install (configures everything)
npx github:Wilder1222/memark install

# reconfigure hooks only (no full reinstall)
node ./.memark/bin/cli.js setup-hooks

# manual commands
node ./.memark/bin/cli.js rebuild-index
node ./.memark/bin/cli.js touch-memory --file user/my-preference.md
node ./.memark/bin/cli.js session-end --threshold 10
node ./.memark/bin/cli.js maintain
```

## How It Works

After install, `.claude/settings.json` contains hooks that fire automatically:

- **SessionStart** (`startup|resume|clear|compact`) — runs `rebuild-index` and pipes `MEMORY.md` into Claude's context via stderr
- **SessionEnd** — runs `session-end --threshold 10` to track sessions and trigger periodic maintenance

No manual hook configuration needed.

## License

MIT
