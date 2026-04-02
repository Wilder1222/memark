# memark

Local memory system for Claude Code.

Stores project-level memory in plain Markdown files inside `.memark/`. Automatically loads memory at session start and runs maintenance at session end via Claude Code hooks.

## Install

```bash
npx github:Wilder1222/memark
```

What this does:
- Installs runtime + memory templates to `./.memark/`
- Creates or updates `./CLAUDE.md` with memark block
- Configures Claude Code hooks in `.claude/settings.json`

After install, every Claude session will automatically:
1. **Session start** — rebuild memory index and inject it into Claude's context
2. **Session end** — run maintenance (confidence decay, cleanup) on a threshold schedule

## What Gets Created

```text
.memark/
  bin/cli.js          ← Runtime CLI
  lib/                ← Runtime logic
  MEMORY.md           ← Memory index (auto-rebuilt each session)
  AGENT-INSTRUCTIONS.md ← Memory writing protocol
  TEMPLATE.md         ← Template for new memory files
  *.md                ← Your memory files go here
```

## Memory File Format

Each memory is a Markdown file with YAML frontmatter in `.memark/`:

```markdown
---
name: User prefers concise responses
tags: [communication, style]
confidence: 0.9
created: 2026-03-25
last_accessed: 2026-03-25
access_count: 1
---

User wants direct answers without preamble or trailing summaries.

**Why:** User explicitly asked to stop summarizing at end of responses.
**How to apply:** Keep responses concise, no trailing summaries.
```

Validation rules:
- `confidence`: number in [0.0, 1.0] — decays ×0.8 per 30 days idle
- date fields: `YYYY-MM-DD`

## Commands

```bash
# one-time project install (configures everything)
npx github:Wilder1222/memark install

# reconfigure hooks only
node ./.memark/bin/cli.js setup-hooks

# manual commands
node ./.memark/bin/cli.js rebuild-index
node ./.memark/bin/cli.js touch-memory --file my-memory.md
node ./.memark/bin/cli.js session-end --threshold 10
node ./.memark/bin/cli.js maintain
```

## How It Works

`.claude/settings.json` hooks fire automatically:

- **SessionStart** — runs `rebuild-index` and pipes `MEMORY.md` into Claude's context via stderr
- **SessionEnd** — runs `session-end --threshold 10` for periodic maintenance

No manual hook configuration needed.

## License

MIT
