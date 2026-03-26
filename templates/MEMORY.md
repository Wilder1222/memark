# Memory Index

_Last updated: {{DATE}} | Total: 0 memories_

> **Agent Instructions:**
> 1. Read this file at the start of every session to understand available memories
> 2. Match relevant memory entries based on current task keywords and context
> 3. Only load specific memory files relevant to the current task (avoid loading all)
> 4. Tags live in each memory file's frontmatter, not in this index
> 5. After changing memory files, run `npx agent-memory rebuild-index`
> 6. Full operation protocol: see `AGENT-INSTRUCTIONS.md`

---

## User
_User preferences, habits, background information_

<!-- Format: - [Memory Name](user/file.md) — one-line summary [confidence: X.X] -->

(no memories yet)

---

## Project
_Project decisions, context, progress, tech choices_

<!-- Format: - [Memory Name](project/file.md) — one-line summary [confidence: X.X] -->

(no memories yet)

---

## Patterns
_Distilled work patterns, best practices, recurring solutions_

<!-- Format: - [Memory Name](patterns/file.md) — one-line summary [confidence: X.X] -->

(no memories yet)

---

## Feedback
_User corrections or confirmations of Agent behavior_

<!-- Format: - [Memory Name](feedback/file.md) — one-line summary [confidence: X.X] -->

(no memories yet)

---

## Maintenance Notes

- This index enforces a hard 200-line cap and may omit lowest-confidence entries from index view
- Prune order: lowest confidence first; ties resolved by section order user -> project -> patterns -> feedback
- Full maintenance protocol: see `MAINTENANCE.md`
- Use `npx agent-memory session-end` to increment maintenance counter after each work session
- Run `npx agent-memory maintain` manually when you want immediate decay/archive behavior
