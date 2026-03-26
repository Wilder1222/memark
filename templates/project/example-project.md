---
name: Agent Memory System Project Context
type: project
tags: [memory-system, npm-package, markdown, self-evolving, agent]
confidence: 0.9
created: 2026-03-25
last_accessed: 2026-03-25
access_count: 1
ttl: null
related: ["patterns/example-maintenance-pattern.md"]
---

This project is a publishable npm package (`agent-memory`) providing a self-evolving local memory system for AI agents. Pure Markdown, zero dependencies. Supports both project-level (`./memory/`) and global installation (`~/.claude/memory/`).

Key design decisions:
- Confidence decay (×0.8 every 30 days idle) to prevent memory rot
- MEMORY.md as dynamic index (≤200 lines) for fast retrieval
- archive/ for gradual deprecation without permanent deletion
- CLI: `npx agent-memory init [--global]` and `npx agent-memory maintain`

**Why:** AI agents lose context between sessions. This system provides persistent, structured memory without requiring a database or external service.

**How to apply:** Reference this when making architecture decisions about the memory system. All design choices should serve the goals of fast retrieval and preventing memory rot.
