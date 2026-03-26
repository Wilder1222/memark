# Integration Guide — Claude CLI / Codex CLI Hook Mode

Integrate `memark` with Claude CLI / Codex CLI hooks so memory is processed automatically.

## 1. Install memark

```bash
npx github:Wilder1222/memark install
```

This installs runtime files into `./.memark/`, initializes `./memory/`, and injects/updates the memark prompt block in `./CLAUDE.md`.

## 2. Runtime Command Base

```bash
node ./.memark/bin/cli.js <command>
```

## 3. Hook Commands (Automatic)

Bind these commands in your Claude CLI hook points:

- `session_start`:
  `node ./.memark/bin/cli.js rebuild-index`
- `after_memory_read`:
  `node ./.memark/bin/cli.js touch-memory --file <type/file.md>`
- `session_end`:
  `node ./.memark/bin/cli.js session-end --threshold 10`
- `manual_maintenance`:
  `node ./.memark/bin/cli.js maintain`

## 4. Example Hook Script

```bash
#!/usr/bin/env bash
set -e

event="$1"
file="$2"

case "$event" in
  session_start)
    node ./.memark/bin/cli.js rebuild-index
    ;;
  after_memory_read)
    node ./.memark/bin/cli.js touch-memory --file "$file"
    ;;
  session_end)
    node ./.memark/bin/cli.js session-end --threshold 10
    ;;
  maintain)
    node ./.memark/bin/cli.js maintain
    ;;
esac
```

## 5. CLAUDE.md Snippet

```markdown
# Memory Hook Policy

- Hooks are configured to run memark automatically.
- Hooks run memory operations automatically.

Session start: rebuild index and read `memory/MEMORY.md`.
During work: hook tracks memory reads via `touch-memory`.
Session end: hook runs `session-end --threshold 10`.
```

## Memory File Format

Each memory file must have YAML frontmatter:

```markdown
---
name: Example Memory
type: user                    # user | project | pattern | feedback
created: 2025-01-20
last_accessed: 2025-01-20
access_count: 1
confidence: 0.9              # 0.0-1.0 (required)
tags: [example, test]
ttl: null                    # null (permanent) or days
related: []
---

# Content

Your memory content here...
```

## More Information

- See **README.md** for full command reference
- See **spec.md** for v1 contract details
- See **templates/** for example memory files
