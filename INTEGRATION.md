# Integration Guide — Claude Code Hooks (Automatic)

Integrate `memark` with Claude Code so memory is loaded and maintained automatically across sessions.

## 1. Install memark

```bash
npx github:Wilder1222/memark install
```

This does everything:
- Installs runtime files into `./.memark/`
- Initializes `./memory/` directory
- Updates `./CLAUDE.md` with memark prompt block
- Configures Claude Code hooks in `.claude/settings.json`

**That's it.** No manual hook configuration needed.

## 2. What Happens Automatically

### Session Start

When Claude starts (or resumes/clears/compacts), the `SessionStart` hook:
1. Runs `rebuild-index` to scan all memory files and rebuild `MEMORY.md`
2. Pipes the full `MEMORY.md` content to stderr, which Claude Code injects as context

This means Claude sees the memory index at the start of every session.

### Session End

When a Claude session ends, the `SessionEnd` hook:
1. Runs `session-end --threshold 10`
2. After every 10 sessions, triggers a full maintenance pass (confidence decay, TTL archival, low-confidence archival)

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
            "command": "node ./.memark/bin/cli.js rebuild-index 1>&2 && cat ./memory/MEMORY.md 1>&2"
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

If you need to update hooks without a full reinstall:

```bash
node ./.memark/bin/cli.js setup-hooks
```

## 5. Manual Commands

These commands are available for manual use or debugging:

```bash
node ./.memark/bin/cli.js rebuild-index        # Rebuild MEMORY.md index
node ./.memark/bin/cli.js touch-memory --file <type/file.md>  # Update access metadata
node ./.memark/bin/cli.js session-end           # Record session end
node ./.memark/bin/cli.js maintain              # Force full maintenance
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
