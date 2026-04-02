# Agent Instructions — Memory System

## How It Works

Memory files live in `.memark/` as flat Markdown files with YAML frontmatter.
The `MEMORY.md` index is auto-loaded at session start via Claude Code hooks.

---

## Writing New Memories

When you learn something worth remembering across sessions:

1. **Check for duplicates** — scan MEMORY.md index for similar entries. Update existing ones instead of creating new files.

2. **Create the file** in `.memark/` using naming convention: `<topic>_<YYYY-MM-DD>.md`
   - Example: `no-trailing-summaries_2026-03-25.md`
   - Use TEMPLATE.md as reference for frontmatter

3. **Run rebuild-index** — `node ./.memark/bin/cli.js rebuild-index`

## Memory File Format

```yaml
---
name: Human-readable memory name
tags: [tag1, tag2]
confidence: 0.9
created: YYYY-MM-DD
last_accessed: YYYY-MM-DD
access_count: 1
---
```

Body structure:
```
[Main memory content — what to remember]

**Why:** [Context/reason this matters]
**How to apply:** [When and how to use this memory]
```

---

## What NOT to memorize

- Code patterns or architecture already visible in the codebase
- Git history or recent changes (use `git log` instead)
- Debugging solutions (put them in commit messages)
- Anything already in CLAUDE.md or project documentation
- Ephemeral task details that won't matter next session
