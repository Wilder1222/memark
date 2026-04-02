# Integration Guide — Claude Code Hooks (Automatic)

Integrate `memark` with Claude Code so memory is loaded and maintained automatically across sessions.

## 1. Install memark

```bash
npx github:Wilder1222/memark install
```

This does everything:
- Installs runtime + memory into `./.memark/`
- Updates `./CLAUDE.md` with memark prompt block
- Configures Claude Code hooks in `.claude/settings.json`

**That's it.** No manual hook configuration needed.

## 2. What Happens Automatically

### Session Start

When Claude starts (or resumes/clears/compacts), the `SessionStart` hook:
1. Runs `rebuild-index` to scan all `.memark/*.md` memory files and rebuild `MEMORY.md`
2. Pipes the full `MEMORY.md` content to stderr, which Claude Code injects as context

Claude sees the memory index at the start of every session.

### Session End

When a Claude session ends, the `SessionEnd` hook:
1. Runs `session-end --threshold 10`
2. After every 10 sessions, triggers a full maintenance pass (confidence decay, low-confidence removal)

## 3. Hooks Configuration (Auto-Generated)

The install creates this in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node ./.memark/bin/cli.js rebuild-index 1>&2 && cat ./.memark/MEMORY.md 1>&2"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ./.memark/bin/cli.js session-end --threshold 10"
          }
        ]
      }
    ]
  }
}
```

If `.claude/settings.json` already exists, memark merges its hooks without overwriting other settings.

## 4. Reconfigure Hooks Only

```bash
node ./.memark/bin/cli.js setup-hooks
```

## 5. Manual Commands

```bash
node ./.memark/bin/cli.js rebuild-index        # Rebuild MEMORY.md index
node ./.memark/bin/cli.js touch-memory --file <filename.md>  # Update access metadata
node ./.memark/bin/cli.js session-end           # Record session end
node ./.memark/bin/cli.js maintain              # Force full maintenance
```

## Memory File Format

```markdown
---
name: Example Memory
tags: [example, test]
confidence: 0.9
created: 2025-01-20
last_accessed: 2025-01-20
access_count: 1
---

Your memory content here...

**Why:** Context for this memory
**How to apply:** When to use it
```
