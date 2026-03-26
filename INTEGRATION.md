# Agent Integration Guide — Claude CLI Hook Mode

Integrate `memark` with Claude CLI hooks so memory is processed automatically.

## 1. Add memark Source To User Project

```bash
git clone https://github.com/Wilder1222/memark.git .memark
```

This avoids `npm`/`npx` at runtime. Hooks call Node directly:

```bash
node ./.memark/bin/cli.js <command>
```

## 2. One-Time Initialization

```bash
node ./.memark/bin/cli.js init
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
- Do not run `npm`/`npx` manually for memory operations.

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
