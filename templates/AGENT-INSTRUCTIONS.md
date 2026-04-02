# Agent Instructions — Memory System

This file defines a conservative workflow for AI agents using this memory system.

---

## Session Start Protocol

At the beginning of every session:

1. **Read `MEMORY.md`** — scan the full index to understand what memories exist
2. **Identify relevant memories** — match index entries to current task context:
   - Match by section (`user`, `project`, `patterns`, `feedback`)
   - Match by keywords in the one-line summary
   - Prioritize entries with higher confidence scores
3. **Load relevant memory files** — read only the files relevant to the current task
4. **Optionally update access metadata** — if your agent workflow edits files directly, update:
   - `last_accessed: <today's date>`
   - `access_count: <increment by 1>`
5. **Apply the memories** — let them inform your behavior for this session

---

## Writing New Memories

When you learn something worth remembering:

1. **Classify the memory type:**
   - `user` — user preferences, habits, background, expertise level
   - `project` — project decisions, architecture, context, goals
   - `pattern` — distilled rules, best practices, recurring solutions
   - `feedback` — user corrections ("don't do X") or confirmations ("keep doing Y")

2. **Check for duplicates** — scan MEMORY.md index for similar entries before creating new ones. If similar exists, update it instead.

3. **Create the file** using naming convention: `<type>_<topic>_<YYYY-MM-DD>.md`
   - Example: `feedback_no-trailing-summaries_2026-03-25.md`
   - Use TEMPLATE.md as reference for frontmatter

4. **Update MEMORY.md** — add an index entry in the correct section:
   ```
   - [Memory Name](type/filename.md) — one-line summary [confidence: 0.9]
   ```

5. **Refresh the index explicitly** — run `node ./.memark/bin/cli.js rebuild-index` after creating or editing memory files.

---

## Memory File Format

Every memory file must have this frontmatter:

```yaml
---
name: Human-readable memory name
type: user | project | pattern | feedback
tags: [tag1, tag2, tag3]
confidence: 0.9
created: YYYY-MM-DD
last_accessed: YYYY-MM-DD
access_count: 1
ttl: null
# ttl: days until this memory is archived due to age; set null for permanent
related: []
# related: list of related memory filenames
---
```

Body structure:
```
[Main memory content — what to remember]

**Why:** [Context/reason this matters]
**How to apply:** [When and how to use this memory]
```

---

## Retrieval Strategy

When searching for relevant memories:

1. **Read index first** (`MEMORY.md`) — O(1) entry point
2. **Filter by type** — user memories for preferences, project for context, etc.
3. **Use the one-line summary** — summaries are the main retrieval cue in the index
4. **Sort by confidence** — read higher-confidence memories first
5. **Use tags after loading a file** — tags live in the file frontmatter, not in the index
6. **Load selectively** — only read files that are clearly relevant

---

## Manual Refresh Protocol

When you have created or updated memory files:

1. **Identify new learnings** — what did you learn about the user, project, or patterns?
2. **Write new memories** — create files for significant new information
3. **Update existing memories** — if you learned something that refines an existing memory, update it
4. **Touch memories you read** — run `node ./.memark/bin/cli.js touch-memory --file <type/file.md>`
5. **Run `node ./.memark/bin/cli.js session-end`** — increment maintenance counter and refresh index
6. **Run `node ./.memark/bin/cli.js maintain` manually** — use it when you want an immediate full maintenance pass

## Current v1 Limits

- There is no background automatic session-end hook in the CLI (without command invocation)
- There is no automatic pattern extraction in the CLI
- There is no automatic duplicate merge in the CLI
- Low-confidence entries may be omitted from index when enforcing the 200-line cap

---

## What NOT to memorize

- Code patterns or architecture already visible in the codebase
- Git history or recent changes (use `git log` instead)
- Debugging solutions (put them in commit messages)
- Anything already in CLAUDE.md or project documentation
- Ephemeral task details that won't matter next session
