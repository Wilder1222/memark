---
name: Do Not Modify Machine Config Without Asking
type: feedback
tags: [permissions, safety, system-files, config]
confidence: 1.0
created: 2026-03-25
last_accessed: 2026-03-25
access_count: 1
ttl: null
related: []
---

Do NOT write to the user's machine configuration files (e.g., ~/.claude/, ~/.config/, system directories) without explicit confirmation. Always write to the project directory instead, unless the user explicitly asks for global/machine-level changes.

**Why:** User interrupted a tool call when agent attempted to write directly to ~/.claude/memory/ without confirming the intent. The user's intent was to build a publishable tool, not to modify their own machine config.

**How to apply:** Before writing to any path outside the current project directory, confirm with the user. Default behavior: write only within the project's working directory.
