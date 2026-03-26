---
name: Memory Name Here
type: user
# type options: user | project | pattern | feedback
tags: [tag1, tag2, tag3]
# tags: keywords for retrieval — use 2-5 descriptive tags
confidence: 0.9
# confidence: 0.0-1.0
# - Start new memories at 0.9
# - Decays to 0.72 after 30 days without access (×0.8)
# - Below 0.2 → auto-archived
created: YYYY-MM-DD
last_accessed: YYYY-MM-DD
access_count: 1
# access_count: increment each time this memory is read
ttl: null
# ttl: days until this memory is eligible for archival (due to age); set null for permanent
related: []
# related: list of related memory filenames, e.g. ["patterns/foo.md"]
---

[Main memory content — write the actual fact, rule, or context to remember]

**Why:** [Why this matters — the context, incident, or preference behind it]

**How to apply:** [When to use this memory — specific situations where it's relevant]
