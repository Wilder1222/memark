# agent-memory

Local Markdown memory system for AI agents — pure Markdown, zero dependencies.

Gives any AI agent (Claude Code, Cursor, Copilot, etc.) persistent cross-session memory using plain Markdown files. v1 is intentionally narrow: initialize a memory workspace, rebuild its index, and run manual maintenance when needed.

## Install

```bash
# Project-level memory (creates ./memory/ in current directory)
npx agent-memory init

# Global agent memory (creates ~/.claude/memory/)
npx agent-memory init --global
```

## What Gets Created

```
memory/
├── MEMORY.md                  ← Agent reads this every session (dynamic index)
├── AGENT-INSTRUCTIONS.md      ← Full operating protocol for agents
├── MAINTENANCE.md             ← Maintenance protocol
├── TEMPLATE.md                ← Template for new memory files
├── user/                      ← User preferences & habits
├── project/                   ← Project decisions & context
├── patterns/                  ← Distilled work patterns & rules
├── feedback/                  ← Agent behavior corrections
└── archive/                   ← Low-confidence memory archive
```

`init` copies the template docs and creates empty category directories. Example memory files shipped in `templates/` are reference content only and are not installed into a real memory workspace.

## Quick Start — Add to Your CLAUDE.md

Copy this to your project's `CLAUDE.md` file (create one if you don't have it):

```
# Memory System — How to Use

## Session Start
Run this at the start of each session:
  npx agent-memory rebuild-index

Then read these files:
- memory/MEMORY.md — memory index
- memory/AGENT-INSTRUCTIONS.md — operating protocol

## During Work
When reading a memory file, optionally track access:
  npx agent-memory touch-memory --file memory/<type>/<filename>.md

When creating new memory files, use YAML frontmatter:
---
name: Memory Title
type: user              # user | project | pattern | feedback
created: YYYY-MM-DD
confidence: 0.9         # 0.0-1.0
tags: [tag1, tag2]
ttl: null               # null (permanent) or days
---

Memory content in Markdown...

## Session End
Run this at the end of your session:
  npx agent-memory session-end --threshold 10

This auto-runs full maintenance every 10 sessions.

## Emergency Maintenance
If needed, trigger full maintenance manually:
  npx agent-memory maintain
```

---

## Connect Your Agent

### How It Works

1. **Initialize once**: `npx agent-memory init` → creates `memory/` directory
2. **Each session start**: Copy the bash commands above to automate
3. **Memories are stored** as Markdown files in `memory/user/`, `memory/project/`, `memory/patterns/`, `memory/feedback/`
4. **System auto-maintains**: After 10 sessions, old/low-confidence memories are archived

### Reference: Full Commands

```bash
# Initialize (one-time)
npx agent-memory init                    # project-level (./memory/)
npx agent-memory init --global           # global (~/.claude/memory/)

# Session workflow
npx agent-memory rebuild-index           # rebuild index at session start
npx agent-memory touch-memory --file <path>   # track file reads
npx agent-memory session-end             # end session, auto-maintain every 10

# Manual maintenance
npx agent-memory maintain                # full maintenance: TTL → decay → archive → rebuild
```

### Memory File Format

Each memory is a `.md` file with YAML frontmatter:

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

**Why:** Verbose responses slow down their workflow.
**How to apply:** Lead with the answer. Skip filler phrases.
```

### Memory Types

| Type | Purpose |
|------|---------|
| `user` | User preferences, habits, expertise level |
| `project` | Project decisions, architecture, context |
| `pattern` | Distilled rules, best practices, recurring solutions |
| `feedback` | Agent behavior corrections and confirmations |

### How to Use the Memory System

Your AI agent should follow this workflow:

#### Session Start
```bash
npx agent-memory rebuild-index
```
Then:
1. Read `memory/MEMORY.md` — dynamic index of all active memories
2. Read `memory/AGENT-INSTRUCTIONS.md` — full operating protocol
3. Load relevant memory files from `memory/<type>/` directories

#### During Work
When you read a memory file, optionally track the access:
```bash
npx agent-memory touch-memory --file memory/<type>/<filename>.md
```
This updates:
- `last_accessed` to today
- `access_count` +1

Create new memories in appropriate directories:
- `memory/user/` — Your preferences and habits
- `memory/project/` — Project decisions and context
- `memory/patterns/` — Work patterns and rules
- `memory/feedback/` — Agent behavior corrections

#### Session End
```bash
npx agent-memory session-end --threshold 10
```
Behavior:
- Increments session counter in `.maintenance-state.json`
- Rebuilds index automatically
- Auto-runs full `maintain` when counter ≥ threshold (default 10)

#### Manual Maintenance (if needed)
```bash
npx agent-memory maintain
```
Runs full pass: TTL archive → decay → confidence archive → index rebuild

### Memory File Format

Each memory must have YAML frontmatter:

```markdown
---
name: Memory Title
type: user              # user | project | pattern | feedback
created: YYYY-MM-DD
confidence: 0.9         # 0.0-1.0 (required)
tags: [tag1, tag2]
ttl: null               # null = permanent, or N = archive after N days
last_accessed: YYYY-MM-DD
access_count: 1
related: []
---

Your memory content in Markdown...
```

**Validation requirements:**
- `type` must be: `user | project | pattern | feedback`
- `confidence` must be numeric: 0.0 to 1.0
- Dates must be: YYYY-MM-DD format
- `ttl` must be: null or positive integer

## Memory File Format

Each memory is an independent `.md` file with YAML frontmatter:

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

**Why:** Verbose responses slow down their workflow.
**How to apply:** Lead with the answer. Skip filler phrases.
```

### Memory Types

| Type | Purpose |
|------|---------|
| `user` | User preferences, habits, expertise level |
| `project` | Project decisions, architecture, context |
| `pattern` | Distilled rules, best practices, recurring solutions |
| `feedback` | Agent behavior corrections and confirmations |

## Current Scope

V1 supports three explicit operations:

- `init`: create the memory directory structure and seed files
- `rebuild-index`: rescan existing memory files and rewrite `MEMORY.md`
- `maintain`: run a manual maintenance pass
- `touch-memory`: update `last_accessed` and increment `access_count` for one file
- `session-end`: increment maintenance counter and trigger `maintain` at threshold

Current maintenance behavior is intentionally conservative:

- If `ttl` is set and the file is older than `ttl` days, it is archived immediately (hard deadline)
- If `last_accessed` is older than 30 days, decay uses 30-day buckets: `confidence × 0.8^k`, where `k = floor(days/30)`
- If `confidence < 0.2`, the file is archived
- Frontmatter is validated; files with invalid fields are flagged but still processed
- `MEMORY.md` is rebuilt at the end of the run and hard-capped at 200 lines

Not in v1:

- Automatic background hooks that run without explicit command invocation
- Automatic pattern extraction
- Automatic duplicate merging

## Commands

```bash
# Initialize memory system
npx agent-memory init                    # project-level (./memory/)
npx agent-memory init --global           # global (~/.claude/memory/)
npx agent-memory init --force            # overwrite existing

# Run maintenance (decay + archive + rebuild index)
npx agent-memory maintain                # on ./memory/
npx agent-memory maintain --global       # on ~/.claude/memory/
npx agent-memory maintain --path ./custom/memory

# Rebuild index only (from existing memory files)
npx agent-memory rebuild-index
npx agent-memory rebuild-index --global
npx agent-memory rebuild-index --path ./custom/memory

# Update one memory's access metadata
npx agent-memory touch-memory --file user/my-preference.md

# End a session and trigger maintain every N sessions (default 10)
npx agent-memory session-end
npx agent-memory session-end --threshold 10
```

### Command Contract

- `init`: copies the shipped templates into the target directory, but skips bundled `example-*.md` reference files. Fails if the target exists and is non-empty unless `--force` is set.
- `rebuild-index`: scans `user/`, `project/`, `patterns/`, and `feedback/` for Markdown files with frontmatter and rewrites `MEMORY.md` with a hard 200-line cap.
- `maintain`: archives files whose `ttl` has expired, applies bucketed decay for every 30 idle days, archives files below confidence `0.2`, then runs `rebuild-index`.
- `touch-memory`: updates one memory file's `last_accessed` to today and increments `access_count`.
- `session-end`: increments maintenance counter (`.maintenance-state.json`), runs `rebuild-index`, and auto-runs `maintain` when the threshold is reached.

## How the Agent Uses Memory

**Session start:**
1. Read `MEMORY.md` index
2. Match relevant entries to current task
3. Load only relevant memory files
4. Optionally update `last_accessed` on files read if your agent workflow edits memory files directly

**When files change:**
1. Write new learnings as memory files
2. Update existing memories with new context
3. Run `npx agent-memory touch-memory --file <type/file.md>` for memories you just read
4. Run `npx agent-memory session-end` to update counter and refresh index
5. Run `npx agent-memory maintain` manually when you need an immediate full maintenance pass

## Automation Blueprint (Agent Integration)

Use the following command-level workflow to automate reading, storage, and updates in every session.

### 1. Session Start (automatic read)

Run:

```bash
npx agent-memory rebuild-index
```

Then let the agent:
- Read `MEMORY.md`
- Select relevant memory files by section + summary + confidence
- Load only selected memory files

### 2. During Work (automatic update of reads)

Whenever the agent reads a memory file, call:

```bash
npx agent-memory touch-memory --file <type/file.md>
```

This updates:
- `last_accessed` to today
- `access_count` +1

### 3. Session End (automatic store + maintenance trigger)

After writing/updating memory files, call:

```bash
npx agent-memory session-end
```

Behavior:
- Increments session counter in `.maintenance-state.json`
- Rebuilds index each time
- Auto-runs full `maintain` when threshold is reached (default 10)

Custom threshold:

```bash
npx agent-memory session-end --threshold 10
```

### 4. Emergency Full Maintenance

If you want immediate decay/archive processing, run:

```bash
npx agent-memory maintain
```

### Recommended Agent Hook Points

- On session start: call `rebuild-index`
- On each memory read: call `touch-memory`
- On session end: call `session-end`
- On explicit maintenance request: call `maintain`

This gives an end-to-end automated loop without background daemons.

## Project Structure

```
bin/
  cli.js              — CLI entry point
lib/
  init.js             — init command
  maintain.js         — maintain command (decay + archive)
  rebuild-index.js    — MEMORY.md index rebuilder
  touch-memory.js     — access metadata updater for one memory file
  session-end.js      — session counter + threshold-triggered maintenance
templates/            — Files copied on init
  MEMORY.md
  AGENT-INSTRUCTIONS.md
  MAINTENANCE.md
  TEMPLATE.md
  user/
  project/
  patterns/
  feedback/
  archive/

Example memory files remain in `templates/` as references for authors, but `init` does not install them into the generated memory directory.
```

## License

MIT
