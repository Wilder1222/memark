# memark

Local memory system for Claude CLI and Codex CLI.

Memark stores long-term memory in plain Markdown files and is designed to run automatically through Claude CLI / Codex CLI hooks.

## Install

```bash
# Project-level install (recommended)
npx github:Wilder1222/memark install
```

What this does automatically:
- Installs runtime files to `./.memark/`
- Creates `./memory/` (if missing)
- Creates or updates `./CLAUDE.md` with required memark prompt block

## Hook-First Workflow

In Claude CLI, configure hooks so memory operations run automatically.

Recommended lifecycle:

1. Session start:
   - `node ./.memark/bin/cli.js rebuild-index`
2. After reading a memory file:
   - `node ./.memark/bin/cli.js touch-memory --file <type/file.md>`
3. Session end:
   - `node ./.memark/bin/cli.js session-end --threshold 10`
4. Manual fallback:
   - `node ./.memark/bin/cli.js maintain`

## CLAUDE.md Snippet (Copy Directly)

```markdown
# Memory Hook Policy

This project uses memark via Claude CLI hooks.
Memory operations are triggered automatically by hooks.

Session start hook:
- node ./.memark/bin/cli.js rebuild-index
- read memory/MEMORY.md
- read memory/AGENT-INSTRUCTIONS.md

After memory read hook:
- node ./.memark/bin/cli.js touch-memory --file <type/file.md>

Session end hook:
- node ./.memark/bin/cli.js session-end --threshold 10

Manual maintenance fallback:
- node ./.memark/bin/cli.js maintain
```

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
# one-time project install
npx github:Wilder1222/memark install

# runtime commands used by hooks
node ./.memark/bin/cli.js rebuild-index
node ./.memark/bin/cli.js touch-memory --file user/my-preference.md
node ./.memark/bin/cli.js session-end --threshold 10
node ./.memark/bin/cli.js maintain
```

## Scope

V1 supports explicit command-driven memory lifecycle:

- init
- rebuild-index
- touch-memory
- session-end
- maintain

## License

MIT
